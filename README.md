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

The default editor credential is `***************` — click the lock icon in the header to unlock page, hierarchy, and upload editing. Change it from Site Settings once unlocked.
