# Checked column starter examples

These four runnable apps are based on the [AdonisJS starter kits](https://github.com/adonisjs/starter-kits) at commit `46d235932e3eb6472a16b740fa0b47b5f69fc6fc`. Each app installs the package from the published [v0.2.0 archive](https://github.com/Kevinjohn/oss-adonisjs-lucid-checked-columns/releases/tag/v0.2.0). The `ReadingItem` model stores a list of `work`, `personal`, or `reference` labels in one checked JSON column. Its validator also rejects malformed or unrecognized values when Lucid loads stored rows.

| App | Journey |
| --- | --- |
| [API](api) | Create and list items with the starter's bearer token |
| [Hypermedia](hypermedia) | Sign in, open the reading list, and submit an Edge form |
| [Inertia React](inertia_react) | Sign in and use the React reading list page |
| [Inertia Vue](inertia_vue) | Sign in and use the Vue reading list page |

Use Node 24 and pnpm. From an app directory, run:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
node ace generate:key
node ace migration:run
node ace codegen
pnpm test
pnpm dev
```

For a browser app, open the local URL printed by `pnpm dev`, sign up, then follow **Open your reading list** on the dashboard. Add a title and label, then reload the list to see the persisted value. The form posts to the protected `/reading-items` route. The API uses the starter's existing bearer-token guard and `/api/v1/account/reading-items` routes; no session cookie is needed. See [API instructions](api/README.md#reading-list-example) for requests.

The focused tests in each app exercise create/read and corrupt a database row deliberately to prove read-side rejection. List requests return a generic error when they encounter a corrupt row. The API test uses a real bearer token; the browser tests use signed-in requests with CSRF protection. These corrupt rows are test fixtures only.
