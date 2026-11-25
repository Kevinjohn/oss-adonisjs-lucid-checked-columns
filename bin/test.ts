import { assert } from '@japa/assert'
import { expectTypeOf } from '@japa/expect-type'
import { processCLIArgs, configure, run } from '@japa/runner'

processCLIArgs(process.argv.slice(2))
configure({
  files: ['tests/**/*.spec.ts'],
  plugins: [assert(), expectTypeOf()],
  timeout: 10_000,
  // Japa exits 0 when its filters select nothing; a gate that ran no tests checked nothing.
  teardown: [
    (runner) => {
      const { passed, failed, regression } = runner.getSummary().aggregates
      const executed = passed + failed + regression
      console.log(`\nExecuted tests: ${executed}`)
      if (executed === 0) {
        console.error('No tests executed: check the --files, --tests and --groups filters')
        process.exitCode = 1
      }
    },
  ],
})

run()
