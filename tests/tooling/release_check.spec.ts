import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'

const root = fileURLToPath(new URL('../../', import.meta.url))
const releaseScript = join(root, 'bin/release_check.sh')
const nodeBin = join(process.execPath, '..')
const standardBin = '/usr/bin'
const commands = ['awk', 'basename', 'cut', 'git', 'ls', 'mkdir', 'node', 'rm', 'sed']
const validDigest = 'a'.repeat(64)

async function fixture(shasum?: 'fail' | 'empty' | 'malformed' | 'valid') {
  const cwd = await mkdtemp(join(tmpdir(), 'checked-columns-release-'))
  const bin = join(cwd, 'bin')
  await mkdir(bin)

  for (const command of commands) {
    const from = command === 'node' ? join(nodeBin, command) : join(standardBin, command)
    await symlink(from, join(bin, command))
  }

  await writeFile(
    join(bin, 'pnpm'),
    [
      '#!/bin/bash',
      'case "$1" in',
      '  build) exit 0 ;;',
      '  pack) mkdir -p "$3"; : > "$3/candidate.tgz"; : > "$PWD/pack-completed" ;;',
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 }
  )

  if (shasum) {
    const output =
      shasum === 'valid'
        ? `${validDigest}  candidate.tgz\n`
        : shasum === 'empty'
          ? ''
          : shasum === 'malformed'
            ? `not-a-digest  candidate.tgz\n`
            : ''
    await writeFile(
      join(bin, 'shasum'),
      ['#!/bin/bash', shasum === 'fail' ? 'exit 23' : `printf '%s' '${output}'`, ''].join('\n'),
      { mode: 0o755 }
    )
  }

  await writeFile(join(cwd, 'package.json'), '{"version":"0.2.0"}\n')
  await writeFile(
    join(cwd, 'CHANGELOG.md'),
    '# Changelog\n\n## Unreleased\n\n## 0.2.0 - 2026-11-16\n\nRelease candidate.\n'
  )
  spawnSync('/usr/bin/git', ['init', '-q'], { cwd })
  spawnSync('/usr/bin/git', ['remote', 'add', 'origin', 'https://github.com/example/repo.git'], {
    cwd,
  })

  return { cwd, path: bin }
}

test('release readiness prints a checked SHA-256 in a successful dry run', async ({ assert }) => {
  const { cwd, path } = await fixture('valid')
  try {
    const result = spawnSync('/bin/bash', [releaseScript], {
      cwd,
      env: { ...process.env, PATH: path },
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.include(result.stdout, 'ready: v0.2.0 tmp/release/candidate.tgz')
    await readFile(join(cwd, 'pack-completed'))
    const notes = await readFile(join(cwd, 'tmp/release/notes.md'), 'utf8')
    assert.include(notes, `SHA-256: \`${validDigest}\``)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('release readiness fails after packing when checksum is missing, fails, empty or malformed', async ({
  assert,
}) => {
  for (const kind of [undefined, 'fail', 'empty', 'malformed'] as const) {
    const { cwd, path } = await fixture(kind)
    try {
      const result = spawnSync('/bin/bash', [releaseScript], {
        cwd,
        env: { ...process.env, PATH: path },
        encoding: 'utf8',
      })

      assert.notEqual(result.status, 0, `${kind ?? 'missing'} checksum utility`)
      await readFile(join(cwd, 'pack-completed'))
      assert.notInclude(result.stdout, 'ready:', `${kind ?? 'missing'} checksum utility`)
      if (kind === 'empty' || kind === 'malformed')
        assert.include(result.stderr, 'invalid SHA-256 digest')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
})
