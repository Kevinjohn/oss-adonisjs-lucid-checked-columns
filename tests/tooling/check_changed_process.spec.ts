import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { test } from '@japa/runner'
import { collectExit, isAlive, outputOf, waitForFile, waitForPid } from './child_process.js'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const runnerPath = path.join(repoRoot, 'bin/check_changed.ts')
const plannerPath = path.join(repoRoot, 'bin/check_changed_plan.ts')

type FixtureOptions = {
  command?: 'normal' | 'hang' | 'missing' | 'no-ready'
  hook?: 'record-term' | 'fail-reap'
  gitMissing?: boolean
  gitFailure?: 'exit' | 'signal'
}

type Fixture = {
  directory: string
  root: string
  bin: string
  log: string
  ready: string
  termSent: string
  base: string
  env: NodeJS.ProcessEnv
  child?: ChildProcess
}

async function fixture(
  registerCleanup: (callback: () => Promise<void>) => void,
  options: FixtureOptions = {}
): Promise<Fixture> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lucid-checked-columns-check-changed-'))
  const commandPid = path.join(directory, 'command.pid')
  const owned: { child?: ChildProcess } = {}
  registerCleanup(async () => {
    try {
      const pid = await waitForPid(commandPid, 1)
      try {
        process.kill(-pid, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith('Timed out waiting'))) throw error
    }
    const child = owned.child
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = new Promise<void>((resolve) => child.once('close', () => resolve()))
      child.kill('SIGKILL')
      child.stdout?.destroy()
      child.stderr?.destroy()
      await closed
    }
    child?.stdout?.destroy()
    child?.stderr?.destroy()
    await rm(directory, { recursive: true, force: true })
  })
  const root = path.join(directory, 'checkout')
  const bin = path.join(directory, 'bin')
  const supportBin = path.join(directory, 'support-bin')
  await mkdir(path.join(root, 'bin'), { recursive: true })
  await mkdir(bin)
  await mkdir(supportBin)
  await writeFile(path.join(root, 'bin/check_changed.ts'), await readFile(runnerPath))
  await writeFile(path.join(root, 'bin/check_changed_plan.ts'), await readFile(plannerPath))
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n')
  await writeFile(path.join(root, 'README.md'), 'fixture baseline\n')
  await symlink(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir')

  const git = execFileSync('which', ['git'], { encoding: 'utf8' }).trim()
  if (!options.gitMissing) await symlink(git, path.join(supportBin, 'git'))
  const runGit = (args: string[]) => execFileSync(git, args, { cwd: root, stdio: 'ignore' })
  runGit(['init', '-q'])
  runGit(['config', 'user.email', 'fixture@example.test'])
  runGit(['config', 'user.name', 'Fixture'])
  runGit(['add', '.'])
  runGit(['commit', '-qm', 'fixture baseline'])
  const base = execFileSync(git, ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  await writeFile(path.join(root, 'src-trigger.ts'), 'export const changed = true\n')
  runGit(['add', 'src-trigger.ts'])
  runGit(['commit', '-qm', 'select static checks'])
  if (options.gitFailure) {
    await rm(path.join(supportBin, 'git'))
    await writeFile(
      path.join(supportBin, 'git'),
      options.gitFailure === 'exit'
        ? `#!/bin/sh\nif [ "$1" = "rev-parse" ]; then exec ${git} "$@"; fi\necho git-failure >&2\nexit 7\n`
        : `#!/bin/sh\nif [ "$1" = "rev-parse" ]; then exec ${git} "$@"; fi\nkill -TERM $$\n`,
      { mode: 0o755 }
    )
  }
  const log = path.join(directory, 'commands.log')
  const ready = path.join(directory, 'descendant.pid')
  const termSent = path.join(directory, 'term-sent')
  await writeFile(log, '')

  await writeFile(
    path.join(root, 'worker.js'),
    `import { writeFile } from 'node:fs/promises'\nprocess.on('SIGTERM', () => {})\nif (process.env.CHECK_CHANGED_NO_READY !== '1') await writeFile(${JSON.stringify(ready)}, String(process.pid))\nsetInterval(() => {}, 1000)\n`
  )
  if (options.command !== 'missing') {
    const commandPath = path.join(bin, 'pnpm')
    await writeFile(
      commandPath,
      `#!${process.execPath}\nimport { spawn } from 'node:child_process'\nimport { readFile, writeFile } from 'node:fs/promises'\nimport { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(commandPid)}, String(process.pid))\nconst args = process.argv.slice(2)\nawait writeFile(${JSON.stringify(log)}, (await readFile(${JSON.stringify(log)}, 'utf8')) + args.join(' ') + '\\n')\nif (process.env.CHECK_CHANGED_HANG === '1') {\n  spawn(process.execPath, ['worker.js'], { cwd: process.cwd(), stdio: 'ignore' })\n  for (let attempt = 0; attempt < 250; attempt++) {\n    if (await readFile(${JSON.stringify(ready)}, 'utf8').catch(() => '')) break\n    await new Promise((resolve) => setTimeout(resolve, 20))\n  }\n  setInterval(() => {}, 1000)\n}\nconsole.log('Executed tests: 1')\n`,
      { mode: 0o755 }
    )
  }

  if (options.hook) {
    const hookPath = path.join(directory, 'process-hook.cjs')
    const recordTerm = options.hook === 'record-term'
    await writeFile(
      hookPath,
      `const original = process.kill.bind(process)\nlet killedGroup = null\nprocess.kill = (pid, signal) => {\n  if (pid < 0 && signal === 'SIGTERM') require('node:fs').writeFileSync(${JSON.stringify(termSent)}, 'yes')\n  if (pid < 0 && signal === 'SIGKILL') { killedGroup = pid; return original(pid, signal) }\n  if (${recordTerm ? 'false' : 'true'} && pid === killedGroup && signal === 0) return true\n  return original(pid, signal)\n}\n`
    )
  }

  await chmod(directory, 0o755)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${supportBin}`,
  }
  delete env.CHECK_CHANGED_HANG
  if (options.command === 'hang') env.CHECK_CHANGED_HANG = '1'
  if (options.command === 'no-ready') {
    env.CHECK_CHANGED_HANG = '1'
    env.CHECK_CHANGED_NO_READY = '1'
  }
  if (options.hook) {
    env.NODE_OPTIONS =
      `${env.NODE_OPTIONS ?? ''} --require=${path.join(directory, 'process-hook.cjs')}`.trim()
  }
  return {
    directory,
    root,
    bin,
    log,
    ready,
    termSent,
    base,
    env,
    get child() {
      return owned.child
    },
    set child(value) {
      owned.child = value
    },
  }
}

const formatCommand =
  'exec prettier --check --ignore-unknown --no-error-on-unmatched-pattern src-trigger.ts worker.js'

async function assertOnlyFormatCommand(log: string): Promise<void> {
  const contents = await readFile(log, 'utf8')
  assert.deepEqual(contents.trimEnd().split('\n'), [formatCommand])
}

test('later lint and typecheck commands violate the cancellation assertion', async ({
  cleanup,
}) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'checked-columns-commands-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  const log = path.join(directory, 'commands.log')
  for (const command of ['lint', 'typecheck']) {
    await writeFile(log, `${formatCommand}\n${command}\n`)
    await assert.rejects(assertOnlyFormatCommand(log), { name: 'AssertionError' })
  }
})

function launch(f: Fixture): ChildProcess {
  const child = spawn(
    process.execPath,
    ['--import=@poppinss/ts-exec', path.join(f.root, 'bin/check_changed.ts'), '--static', f.base],
    { cwd: f.root, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  f.child = child
  return child
}

test('reports a missing Git executable with its spawn error', async ({ cleanup }) => {
  const f = await fixture(cleanup, { gitMissing: true })
  const output = await outputOf(launch(f))
  const result = await collectExit(output)
  assert.equal(result.code, 2, result.text)
  assert.match(result.text, /git rev-parse .* failed to spawn: spawnSync git ENOENT/)
  assert.doesNotMatch(result.text, /TypeError|Unknown base ref/)
})

test('reports Git command exit and signal failures distinctly', async ({ cleanup }) => {
  for (const [failure, expected] of [
    ['exit', /git merge-base .* exited 7: git-failure/],
    ['signal', /git merge-base .* terminated by SIGTERM/],
  ] as const) {
    const f = await fixture(cleanup, { gitFailure: failure })
    const result = await collectExit(await outputOf(launch(f)))
    assert.equal(result.code, 2, result.text)
    assert.match(result.text, expected)
    assert.doesNotMatch(result.text, /TypeError/)
  }
})

test('runs selected static checks normally and observes a missing command spawn error', async ({
  cleanup,
}) => {
  const normal = await fixture(cleanup)
  const normalChild = launch(normal)
  const normalOutput = await outputOf(normalChild)
  const normalResult = await collectExit(normalOutput)
  assert.equal(normalResult.code, 0, normalResult.text)
  assert.match(normalResult.text, /pass format/)
  assert.match(await readFile(normal.log, 'utf8'), /exec prettier --check/)

  const missing = await fixture(cleanup, { command: 'missing' })
  const missingChild = launch(missing)
  const missingOutput = await outputOf(missingChild)
  const missingResult = await collectExit(missingOutput)
  assert.equal(missingResult.code, 1, missingResult.text)
  assert.match(missingResult.text, /spawn failed: spawn pnpm ENOENT/)
  assert.doesNotMatch(missingResult.text, /UnhandledPromiseRejection|unhandledRejection/)
}).timeout(30_000)

test('completion remains available after close and includes all piped output', async () => {
  const child = spawn(process.execPath, ['-e', "process.stdout.write('complete output')"], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = await outputOf(child)
  const first = await collectExit(output)
  assert.equal(first.code, 0)
  assert.equal(first.text, 'complete output')
  assert.deepEqual(await collectExit(output), first)
})

test('spawn failure rejects completion with the original error', async () => {
  const child = spawn('/no-such-check-changed-executable', [], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = await outputOf(child)
  await assert.rejects(collectExit(output), { code: 'ENOENT' })
})

test('PID readiness waits for a complete positive record', async ({ cleanup }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'checked-columns-pid-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  const pidFile = path.join(directory, 'descendant.pid')
  await writeFile(pidFile, '')
  const ready = waitForPid(pidFile)
  await writeFile(pidFile, '12345')
  assert.equal(await ready, 12345)
  await writeFile(pidFile, 'invalid')
  await assert.rejects(waitForPid(pidFile), /Invalid PID record/)
})

test('failed readiness reaps the owned command group before removing the fixture', async () => {
  const cleanups: Array<() => Promise<void>> = []
  const f = await fixture((callback) => cleanups.push(callback), { command: 'no-ready' })
  try {
    launch(f)
    const commandPid = await waitForPid(path.join(f.directory, 'command.pid'))
    await assert.rejects(waitForPid(f.ready, 100), /Timed out waiting/)
    await cleanups[0]()
    assert.equal(await isAlive(commandPid), false)
    await assert.rejects(readFile(f.directory), { code: 'ENOENT' })
  } finally {
    await cleanups[0]()
  }
}).timeout(10_000)
test('PID readiness stops when the worker exits before publication', async ({ cleanup }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'checked-columns-early-exit-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  const child = spawn(process.execPath, ['-e', ''], { stdio: ['ignore', 'pipe', 'pipe'] })
  const output = await outputOf(child)
  await assert.rejects(
    waitForPid(path.join(directory, 'missing.pid'), 5000, output.completion),
    /exited before publishing a PID/
  )
})

test('TERM-resistant descendants receive KILL, are reaped, and block later selected checks', async ({
  cleanup,
}) => {
  const f = await fixture(cleanup, { command: 'hang' })
  const child = launch(f)
  const output = await outputOf(child)
  const descendantPid = await waitForPid(f.ready, 5000, output.completion)
  child.kill('SIGTERM')
  const result = await collectExit(output)
  assert.equal(result.code, 143, result.text)
  assert.match(result.text, /fail format \(exit killed\)/)
  await assertOnlyFormatCommand(f.log)
  assert.equal(await isAlive(descendantPid), false)
  assert.doesNotMatch(result.text, /UnhandledPromiseRejection|unhandledRejection/)
}).timeout(20_000)

test('a second signal escalates immediately while the first signal determines the exit code', async ({
  cleanup,
}) => {
  const f = await fixture(cleanup, { command: 'hang', hook: 'record-term' })
  const child = launch(f)
  const output = await outputOf(child)
  const descendantPid = await waitForPid(f.ready, 5000, output.completion)
  child.kill('SIGTERM')
  await waitForFile(f.termSent)
  child.kill('SIGINT')
  const result = await collectExit(output)
  assert.equal(result.code, 143, result.text)
  assert.equal(await isAlive(descendantPid), false)
  await assertOnlyFormatCommand(f.log)
}).timeout(15_000)

test('reports failed final reap and retains the first signal result', async ({ cleanup }) => {
  const f = await fixture(cleanup, { command: 'hang', hook: 'fail-reap' })
  const child = launch(f)
  const output = await outputOf(child)
  await waitForPid(f.ready, 5000, output.completion)
  child.kill('SIGTERM')
  const result = await collectExit(output)
  assert.equal(result.code, 143, result.text)
  assert.match(result.text, /cleanup failed:.*did not exit after SIGKILL/s)
  await assertOnlyFormatCommand(f.log)
  assert.doesNotMatch(result.text, /UnhandledPromiseRejection|unhandledRejection/)
}).timeout(20_000)

test('interrupt settles a never-closing owned child and releases its live local handles', async ({
  cleanup,
}) => {
  const f = await fixture(cleanup)
  const hook = path.join(f.directory, 'never-close.cjs')
  await writeFile(
    hook,
    `
const cp = require('node:child_process')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
cp.spawn = () => {
 const child = new EventEmitter(); child.pid = 99999999; child.exitCode = child.signalCode = null
 child.stdout = new PassThrough(); child.stderr = new PassThrough()
 const liveHandle = setInterval(() => {}, 1000)
 child.unref = () => { clearInterval(liveHandle); console.log('LOCAL_HANDLE_RELEASED') }
 setImmediate(() => { child.stdout.write('partial output'); process.emit('SIGTERM') })
 return child
}
process.kill = () => true
let clock = 0; Date.now = () => (clock += 6000)
require('node:module').syncBuiltinESMExports()
`
  )
  f.env.NODE_OPTIONS = `${f.env.NODE_OPTIONS ?? ''} --require=${hook}`
  const child = launch(f)
  const output = await outputOf(child)
  const result = await collectExit(output)
  assert.equal(result.code, 143, result.text)
  assert.match(result.text, /did not exit after SIGKILL/)
  assert.match(result.text, /partial output/)
  assert.match(result.text, /LOCAL_HANDLE_RELEASED/)
  assert.equal(await readFile(f.log, 'utf8'), '')
}).timeout(10_000)

test('deadline and successful group cleanup settle a held pipe without close', async ({
  cleanup,
}) => {
  for (const mode of ['deadline', 'interrupt'] as const) {
    const f = await fixture(cleanup)
    const hook = path.join(f.directory, 'held-pipe.cjs')
    await writeFile(
      hook,
      `const cp = require('node:child_process')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const originalTimeout = global.setTimeout
if (${mode === 'deadline'}) global.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 900000 ? 0 : delay, ...args)
cp.spawn = () => {
 const child = new EventEmitter(); child.pid = 99999999; child.exitCode = child.signalCode = null
 child.stdout = new PassThrough(); child.stderr = new PassThrough()
 const liveHandle = setInterval(() => {}, 1000)
 child.unref = () => { clearInterval(liveHandle); console.log('LOCAL_HANDLE_RELEASED') }
 setImmediate(() => { child.stdout.write('partial output'); if (${mode === 'interrupt'}) process.emit('SIGTERM') })
 return child
}
process.kill = (_pid, signal) => { if (signal === 0) { const error = new Error('gone'); error.code = 'ESRCH'; throw error } return true }
require('node:module').syncBuiltinESMExports()
`
    )
    f.env.NODE_OPTIONS = `${f.env.NODE_OPTIONS ?? ''} --require=${hook}`
    const result = await collectExit(await outputOf(launch(f)))
    assert.equal(result.code, mode === 'deadline' ? 1 : 143, result.text)
    assert.match(result.text, /partial output/)
    assert.match(result.text, /LOCAL_HANDLE_RELEASED/)
    if (mode === 'deadline') assert.match(result.text, /stopped after 15 minutes/)
    assert.doesNotMatch(result.text, /cleanup failed/)
  }
}).timeout(10_000)
