/** A file changed since the merge-base. Deleted files select checks but are never passed to tools. */
export interface ChangedFile {
  path: string
  deleted: boolean
}

/** One `pnpm` command run by `pnpm check:changed`. */
export interface ChangedCheckStep {
  label: string
  command: string[]
  /** Report the number of tests the step executed. */
  countsTests?: boolean
  /** Fail when the step executes no tests: its file filter is wrong. */
  requiresTests?: boolean
}

export interface SkippedCheckStep {
  label: string
  skip: string
}

export type PlannedCheckStep = ChangedCheckStep | SkippedCheckStep

const dependencyFiles = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']
// Formatter configuration (and package.json, which pins Prettier) can change any file's format.
const formatterInputs = [
  /^\.prettierrc/,
  /^\.prettierignore$/,
  /^\.editorconfig$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
]

const isSpec = (path: string) => /^tests\/.+\.spec\.ts$/.test(path)
const isTypeScript = (path: string) => /\.[cm]?tsx?$/.test(path)
const isEslintIgnored = (path: string) => /^tmp\//.test(path)
const isLintable = (path: string) =>
  (/\.[cm]?[jt]sx?$/.test(path) && !isEslintIgnored(path)) || dependencyFiles.includes(path)

/** Files that cannot change the built package. */
function isOutsidePackage(path: string): boolean {
  return /^(tests|\.github)\//.test(path) || /^(?:user-stories\/.+|[^/]+)\.md$/.test(path)
}

interface CheckStepSelection {
  when: boolean
  reason: string
}

function buildCheckStep(
  subject: ChangedCheckStep,
  { when, reason }: CheckStepSelection
): PlannedCheckStep {
  return when ? subject : { label: subject.label, skip: reason }
}

export interface PlanOptions {
  /** Leave out every whole suite and the package build: one shared run covers them for a batch. */
  static?: boolean
}

/** Map the changed files to the repository scripts that check them. */
export function planChangedChecks(
  changes: ChangedFile[],
  { static: staticOnly = false }: PlanOptions = {}
): PlannedCheckStep[] {
  const paths = changes.map((change) => change.path)
  const present = changes.filter((change) => !change.deleted).map((change) => change.path)
  const formattable = present
    .filter((path) => path !== 'pnpm-lock.yaml')
    .map((path) => (path.startsWith('-') ? `./${path}` : path))
  const specs = present.filter(isSpec)
  const suite = specs.length < changes.length
  const packageChanged = paths.some((path) => !isOutsidePackage(path))
  const formatAll = paths.some((path) => formatterInputs.some((input) => input.test(path)))

  const buildSuiteStep = (subject: ChangedCheckStep, selection: CheckStepSelection) =>
    selection.when && staticOnly
      ? { label: subject.label, skip: `--static leaves out ${subject.command.join(' ')}` }
      : buildCheckStep(subject, selection)
  const specsOnly = buildCheckStep(
    {
      label: 'tests',
      command: ['pnpm', 'quick:test', ...specs.map((path) => `--files=${path}`)],
      countsTests: true,
      requiresTests: true,
    },
    {
      when: specs.length > 0,
      reason: changes.length > 0 ? 'no test files changed' : 'no files changed',
    }
  )

  return [
    formatAll
      ? { label: 'format', command: ['pnpm', 'format:check'] }
      : buildCheckStep(
          {
            label: 'format',
            command: [
              'pnpm',
              'exec',
              'prettier',
              '--check',
              '--ignore-unknown',
              '--no-error-on-unmatched-pattern',
              ...formattable,
            ],
          },
          { when: formattable.length > 0, reason: 'no changed files to format' }
        ),
    // The repository's own lint script carries the zero-warning limit for every caller.
    buildCheckStep(
      { label: 'lint', command: ['pnpm', 'lint'] },
      { when: paths.some(isLintable), reason: 'no lintable files changed' }
    ),
    buildCheckStep(
      { label: 'typecheck', command: ['pnpm', 'typecheck'] },
      {
        when: paths.some(
          (path) =>
            (isTypeScript(path) && !isEslintIgnored(path)) ||
            path === 'tsconfig.json' ||
            dependencyFiles.includes(path)
        ),
        reason: 'no TypeScript or type configuration changed',
      }
    ),
    ...(!suite
      ? [specsOnly]
      : staticOnly
        ? [{ label: 'test suite', skip: '--static leaves out pnpm quick:test' }, specsOnly]
        : [
            {
              label: 'tests',
              command: ['pnpm', 'quick:test'],
              countsTests: true,
              requiresTests: true,
            },
          ]),
    buildSuiteStep(
      { label: 'build', command: ['pnpm', 'build'] },
      { when: packageChanged, reason: 'no package source changed' }
    ),
  ]
}

/** Read the final executed-test marker emitted by the Japa teardown; 0 when none ran. */
export function executedTests(output: string): number {
  const markers = output.matchAll(/(?:^|\n)Executed tests: (\d+)\r?(?=\n|$)/g)
  let count = 0
  for (const marker of markers) count = Number(marker[1])
  return count
}
