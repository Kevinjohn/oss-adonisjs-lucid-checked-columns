import { spawnSync } from 'node:child_process'
import { PassThrough } from 'node:stream'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'
import {
  executedTests,
  CheckOutput,
  planChangedChecks,
  type ChangedFile,
  type PlannedCheckStep,
} from '../../bin/check_changed_plan.js'

test('bounded output retains split test markers independently of the diagnostic tail', ({
  assert,
}) => {
  const output = new CheckOutput()
  output.append('Executed tests: ', 'stdout')
  output.append('interleaved stderr\n', 'stderr')
  output.append('12\n', 'stdout')
  output.append('x'.repeat(512 * 1024), 'stdout')
  output.append('\nlast diagnostic: café', 'stderr')
  const result = output.finish()
  assert.equal(result.testCount, 12)
  assert.isAtMost(result.output.length, 256 * 1024)
  assert.notInclude(result.output, 'interleaved stderr')
  assert.isTrue(result.output.endsWith('last diagnostic: café'))
})

test('decoded chunks on both streams preserve split UTF-8 and unterminated diagnostic lines', ({
  assert,
}) => {
  const output = new CheckOutput()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  stdout.setEncoding('utf8').on('data', (chunk) => output.append(chunk, 'stdout'))
  stderr.setEncoding('utf8').on('data', (chunk) => output.append(chunk, 'stderr'))
  const text = Buffer.from('café')
  stdout.write(text.subarray(0, 4))
  stdout.write(text.subarray(4))
  stderr.end(' and final error')
  stdout.end()
  assert.equal(output.finish().output, 'café and final error')
})

const packageJson = new URL('../../package.json', import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))
const makeChangedFiles = (...paths: string[]): ChangedFile[] =>
  paths.map((path) => ({ path, deleted: false }))

function listPlannedCommands(plan: PlannedCheckStep[]): Record<string, string[]> {
  return Object.fromEntries(
    plan.flatMap((step) => ('command' in step ? [[step.label, step.command]] : []))
  )
}

test('a changed spec runs on its own and requires executed tests', ({ assert }) => {
  const plan = planChangedChecks(makeChangedFiles('tests/json_column.spec.ts'))
  const tests = plan.find((step) => step.label === 'tests')

  assert.deepEqual(Object.keys(listPlannedCommands(plan)), ['format', 'lint', 'typecheck', 'tests'])
  assert.deepInclude(tests, {
    command: ['pnpm', 'quick:test', '--files=tests/json_column.spec.ts'],
    countsTests: true,
    requiresTests: true,
  })
})

test('package source and manifests run the suite and the build', ({ assert }) => {
  for (const path of ['src/json_column.ts', 'package.json', 'pnpm-lock.yaml']) {
    const commands = listPlannedCommands(
      planChangedChecks(makeChangedFiles(path, 'tests/json_column.spec.ts'))
    )
    assert.deepEqual(commands.tests, ['pnpm', 'quick:test'], path)
    assert.deepEqual(commands.build, ['pnpm', 'build'], path)
  }
})

test('files the specs read run the full suite without building the package', ({ assert }) => {
  for (const path of ['tests/helpers.ts', 'CHANGELOG.md', '.github/workflows/checks.yml']) {
    const commands = listPlannedCommands(planChangedChecks(makeChangedFiles(path)))
    assert.deepEqual(commands.tests, ['pnpm', 'quick:test'], path)
    assert.notProperty(commands, 'build', path)
  }
})

test('nested story Markdown is formatted and runs the suite without selecting a build', ({
  assert,
}) => {
  const story = 'user-stories/catalogue/example.md'
  const commands = listPlannedCommands(planChangedChecks(makeChangedFiles(story)))
  assert.deepEqual(commands.format.slice(-1), [story])
  assert.deepEqual(commands.tests, ['pnpm', 'quick:test'])
  assert.notProperty(commands, 'build')
  assert.deepEqual(
    listPlannedCommands(planChangedChecks(makeChangedFiles(story, 'src/json_column.ts'))).build,
    ['pnpm', 'build']
  )
})

test('lockfile and workspace changes run lint and typecheck', ({ assert }) => {
  for (const path of ['pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    assert.properties(
      listPlannedCommands(planChangedChecks(makeChangedFiles(path))),
      ['lint', 'typecheck'],
      path
    )
  }
})

test('deleted files select checks but are never passed to tools', ({ assert }) => {
  const commands = listPlannedCommands(
    planChangedChecks([
      { path: 'src/old_module.ts', deleted: true },
      { path: 'tests/old_module.spec.ts', deleted: true },
    ])
  )

  assert.notProperty(commands, 'format')
  assert.deepEqual(commands.typecheck, ['pnpm', 'typecheck'])
  assert.deepEqual(commands.tests, ['pnpm', 'quick:test'])
  assert.notInclude(commands.lint.join(' '), 'old_module')
  assert.deepEqual(
    listPlannedCommands(planChangedChecks([{ path: 'tests/old_module.spec.ts', deleted: true }]))
      .tests,
    ['pnpm', 'quick:test']
  )
})

test('formats only existing files and leaves the lockfile to pnpm', ({ assert }) => {
  const commands = listPlannedCommands(planChangedChecks(makeChangedFiles('README.md')))

  assert.deepEqual(commands.format.slice(-1), ['README.md'])
  assert.include(commands.format, '--ignore-unknown')
  assert.include(commands.format, '--no-error-on-unmatched-pattern')
})

test('dash-prefixed root paths are passed literally to Prettier', ({ assert }) => {
  assert.deepEqual(
    listPlannedCommands(planChangedChecks(makeChangedFiles('-format-probe.md'))).format,
    [
      'pnpm',
      'exec',
      'prettier',
      '--check',
      '--ignore-unknown',
      '--no-error-on-unmatched-pattern',
      './-format-probe.md',
    ]
  )
})

test('formatter configuration checks the whole tree', ({ assert }) => {
  for (const path of ['.prettierignore', '.editorconfig', 'package.json'])
    assert.deepEqual(
      listPlannedCommands(planChangedChecks(makeChangedFiles(path))).format,
      ['pnpm', 'format:check'],
      path
    )
})

test('lockfile changes run the full formatter without passing the lockfile', ({ assert }) => {
  assert.deepEqual(
    listPlannedCommands(planChangedChecks(makeChangedFiles('pnpm-lock.yaml'))).format,
    ['pnpm', 'format:check']
  )
})

test('lint allows no warnings and skips files ESLint ignores', async ({ assert }) => {
  assert.deepEqual(listPlannedCommands(planChangedChecks(makeChangedFiles('index.ts'))).lint, [
    'pnpm',
    'lint',
  ])
  // The repository's own lint script carries the zero-warning limit for every caller.
  const manifest = JSON.parse(await readFile(packageJson, 'utf8'))
  assert.include(manifest.scripts.lint, '--max-warnings 0')
  assert.notProperty(listPlannedCommands(planChangedChecks(makeChangedFiles('tmp/x.ts'))), 'lint')
})

test('--static names each selected suite in a skip line instead of running it', ({ assert }) => {
  const plan = planChangedChecks(
    makeChangedFiles('src/json_column.ts', 'package.json', 'README.md'),
    {
      static: true,
    }
  )

  assert.deepEqual(Object.keys(listPlannedCommands(plan)), ['format', 'lint', 'typecheck'])
  for (const [label, skip] of [
    ['test suite', '--static leaves out pnpm quick:test'],
    ['build', '--static leaves out pnpm build'],
  ])
    assert.deepInclude(plan, { label, skip })
})

test('--static still runs the changed specs on their own', ({ assert }) => {
  const plan = planChangedChecks(
    makeChangedFiles('src/json_column.ts', 'tests/json_column.spec.ts'),
    {
      static: true,
    }
  )

  assert.deepEqual(listPlannedCommands(plan).tests, [
    'pnpm',
    'quick:test',
    '--files=tests/json_column.spec.ts',
  ])
  assert.deepInclude(plan, { label: 'test suite', skip: '--static leaves out pnpm quick:test' })
  assert.deepInclude(planChangedChecks(makeChangedFiles('src/json_column.ts'), { static: true }), {
    label: 'tests',
    skip: 'no test files changed',
  })
})

test('--static plans a spec-only change exactly as the default does', ({ assert }) => {
  assert.deepEqual(
    planChangedChecks(makeChangedFiles('tests/json_column.spec.ts'), { static: true }),
    planChangedChecks(makeChangedFiles('tests/json_column.spec.ts'))
  )
})

test('counts executed tests from the Japa summary', ({ assert }) => {
  assert.equal(executedTests('Executed tests: 335'), 335)
  assert.equal(executedTests('Executed tests: 14'), 14)
  assert.equal(executedTests('Executed tests: 1'), 1)
  assert.equal(executedTests('Executed tests: 3'), 3)
  assert.equal(executedTests('Executed tests: 0'), 0)
  assert.equal(executedTests('NO TESTS EXECUTED'), 0)
})

test('uses the last complete executed count after misleading output', ({ assert }) => {
  assert.equal(
    executedTests(
      [
        'Tests 999 passed, 0 skipped (999)',
        'Executed tests: 999',
        'Executed tests: 2 skipped, 1 todo',
        'Executed tests: 2',
      ].join('\n')
    ),
    2
  )
})

test('the test entry rejects empty and skipped-only selections', async ({ assert }) => {
  const fixturePath = 'tests/tooling/skipped-only-probe.spec.ts'
  const specFile = new URL(`./skipped-only-probe.spec.ts`, import.meta.url)
  await writeFile(
    specFile,
    [
      "import { test } from '@japa/runner'",
      "console.log('Tests 999 passed, 0 skipped (999)')",
      "console.log('Executed tests: 999')",
      "test('skipped only', () => {}).skip()",
      '',
    ].join('\n')
  )

  try {
    const empty = spawnSync(
      process.execPath,
      [
        '--import=@poppinss/ts-exec',
        '--enable-source-maps',
        'bin/test.ts',
        '--files=tests/tooling/__no_such_spec__.spec.ts',
      ],
      { cwd: root, encoding: 'utf8' }
    )
    assert.equal(empty.status, 1)
    assert.include(empty.stdout, 'Executed tests: 0')

    const skipped = spawnSync(
      process.execPath,
      [
        '--import=@poppinss/ts-exec',
        '--enable-source-maps',
        'bin/test.ts',
        `--files=${fixturePath}`,
      ],
      { cwd: root, encoding: 'utf8' }
    )
    const output = skipped.stdout + skipped.stderr
    assert.equal(skipped.status, 1)
    assert.include(output, 'Tests 999 passed, 0 skipped (999)')
    assert.include(output, 'Executed tests: 999')
    assert.include(output, 'Executed tests: 0')
    assert.include(output, 'No tests executed:')
  } finally {
    await unlink(specFile)
  }
})

test('the package script runs the check:changed entry point', async ({ assert }) => {
  const scripts = JSON.parse(await readFile(packageJson, 'utf8')).scripts

  assert.equal(
    scripts['check:changed'],
    'node --import=@poppinss/ts-exec --enable-source-maps bin/check_changed.ts'
  )
})
