# Decisions

## AdonisJS framework departures

The entries below are temporary alignment records for the private release consumer, not
exceptions for the published package. The fixture is copied to a disposable directory by
`bin/release_consumer_smoke.sh`, installs the packed candidate and exercises a real Lucid SQLite
round trip. It is not a distributable package. The checker's package detector currently treats
every manifest containing `@adonisjs/core` without `adonisrc.ts` as a package. Its scope correction
is tracked in [conventions issue #22](https://github.com/Kevinjohn/oss-adonisjs-code-conventions/issues/22).
Remove these entries and their configuration links when that correction covers this fixture.

1. **Aligning (Kevinjohn/oss-adonisjs-code-conventions#22)** — TOOL-3:
   `examples/release-consumer/tsconfig.json` deliberately uses a standalone NodeNext configuration
   with `skipLibCheck: true`. It verifies that the installed archive's public declarations resolve
   without inheriting the host package's compiler preset. Adding that preset would change the
   independent consumer setup and require a new dependency solely to satisfy misclassification.
2. **Aligning (Kevinjohn/oss-adonisjs-code-conventions#22)** — PKG-1:
   `examples/release-consumer/model.ts` is the disposable smoke-test entry point, not package
   implementation. The consumer compiles it to `build/model.js` and executes it directly; no
   library entry point is exported.
3. **Aligning (Kevinjohn/oss-adonisjs-code-conventions#22)** — PKG-5:
   `examples/release-consumer/package.json` is private and never packed or published. Publication
   files and exports would describe an API it does not have. Its Node runtime comes from the
   repository's `.nvmrc` and Node 24 release workflow; its manifest does not declare a separate
   engine. All three findings remain tracked until the checker distinguishes consumers.
4. **Aligning (Kevinjohn/oss-adonisjs-code-conventions#22)** — PKG-6:
   `examples/release-consumer/package.json` installs the framework as runtime dependencies because
   the smoke test is a consumer of Lucid and the candidate archive. Making them peer dependencies
   would model a reusable library instead of testing an independent installation. This covers both
   `@adonisjs/core` and `@adonisjs/lucid`; the published package retains its existing peers.
5. **Aligning (Kevinjohn/oss-adonisjs-code-conventions#22)** — PKG-43:
   `examples/release-consumer/package.json` runs a compiled installation smoke test, not a package
   test suite. Coverage belongs to the host package's existing `c8` test script; adding a second
   collector would require another dependency without measuring the host source meaningfully.
