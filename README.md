# Enkl-Wiki

A 100% client-side Content Management System that runs offline and stores pages as Markdown in JSON. See [Enkl-Wiki.md](Enkl-Wiki.md) for the full specification.

## Building

```sh
npm install
npm run build
```

This produces a single self-contained `dist/index.html` (plus starter `dist/pages/` and `dist/uploads/` folders for filesystem-backed content mode). Open it directly via `file://`, host it on a thumb drive, or serve it over `https://`.

## Testing

```sh
npm test
```

Runs the jsdom-based unit, feature, and smoke tests under `tests/`.

## Editing

Click the lock icon in the header and enter a credential to unlock editing. There are two tiers, sharing the same unlock flow:

- **Editor** (default `foobar`) unlocks page, hierarchy, and upload editing.
- **Admin** (default `siteadmin`) unlocks all of that, plus the Site Settings icon (site title/description, either credential, tag pruning, and import/export).

Change either credential from Site Settings once unlocked as an admin.

## Shared Database Backing Store (optional)

Besides the two fully offline modes above (embedded in the site file, or separate files under `/pages`), Enkl-Wiki can also store the whole site — pages, hierarchy, tags, uploads — in a shared PostgreSQL database behind a small ASP.NET Core API, so multiple people/devices can read and edit the same live wiki. This mode is entirely optional; the client-only modes are unaffected and still work with no server at all.

The easiest way to run it is **Docker Compose** — see [server/README.md](server/README.md) for `docker compose up --build` and everything else about running, testing, and connecting to the API (locally or via Docker), including the one-step migration path for moving an existing embedded/filesystem site into the database.
