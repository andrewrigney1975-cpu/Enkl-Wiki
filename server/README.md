# Enkl-Wiki API (shared database backing store)

An ASP.NET Core Web API + PostgreSQL backend that lets Enkl-Wiki store a whole site (pages, hierarchy, tags, uploads) in a shared database instead of the browser, so multiple people/devices can read and edit the same live wiki. It's optional — the client's embedded and filesystem modes need no server at all.

## Quickest way to try it: Docker Compose

From the repo root:

```sh
cp .env.example .env    # then edit POSTGRES_PASSWORD and JWT_SIGNING_KEY
docker compose up --build
```

This builds and runs three containers:

- **`db`** — PostgreSQL 16, with a named volume so data survives restarts.
- **`api`** — this API, applying EF Core migrations automatically on startup and seeding the default `foobar` editor credential on first run. Uploaded files are stored in a named volume.
- **`web`** — the built client (`npm run build`'s `dist/`) served by nginx, which also reverse-proxies `/api/*` to the `api` container. Because the browser and API are on the same origin through this proxy, there's no CORS configuration to worry about.

Open **http://localhost:8080**, unlock editing (`foobar`), open **Site Settings**, and switch **Page content storage** to *Shared database (via API)*. Leave the **API Base URL** field blank (the proxy handles it) and choose whether to migrate your current site's content in.

`docker compose down` stops the stack; add `-v` to also delete the database/uploads volumes.

## Running without Docker

Requires the .NET SDK and a local PostgreSQL instance.

```sh
cd server
ConnectionStrings__Default="Host=localhost;Port=5432;Database=enklwiki;Username=enklwiki;Password=..." \
Jwt__SigningKey="some-long-random-string" \
dotnet run --project EnklWiki.Api
```

`appsettings.Development.json` already has working defaults for a Postgres container on `localhost:5432` with the same credentials as `.env.example`, so running with `ASPNETCORE_ENVIRONMENT=Development` and no extra env vars works too if that matches your local Postgres. Migrations apply automatically on startup, same as in Docker.

Because the client and API are then on different origins, serve `dist/index.html` over a local static file server (not `file://`, which sends `Origin: null`) and set the site's **API Base URL** to wherever the API is listening, e.g. `http://localhost:5299`.

## Testing

```sh
dotnet test
```

Runs `EnklWiki.Api.Tests` — xUnit unit tests for `PageHierarchyService`/`TagService`/`CredentialService`, plus `WebApplicationFactory` integration tests that exercise the full HTTP surface (auth, page CRUD and hierarchy operations, uploads, import/export) against an in-memory database, so no real Postgres is needed to run the suite.

## Project layout

```
/server
  EnklWiki.Api.slnx
  /EnklWiki.Api
    Program.cs              DI, CORS, JWT auth, EF Core registration, migration-on-startup
    /Controllers            AuthController, SiteController, TagsController, PagesController, UploadsController, ImportExportController
    /Data                   AppDbContext + EF Core migrations
    /Models                 Site, Page, Tag, Upload
    /Dtos                   request/response shapes
    /Services               PageHierarchyService (slug/orphan/reorder logic), TagService, CredentialService (PBKDF2 + JWT)
    Dockerfile
  /EnklWiki.Api.Tests        xUnit tests
```

## Notes

- Auth is a single shared editor credential (like the client-only modes), verified server-side and exchanged for a short-lived JWT. Reads are always public; only mutations require the token.
- Page bodies are fetched lazily per page (`GET/PUT /api/pages/{id}/body`), the same pattern the filesystem-backed mode uses for `.md` files.
- `POST /api/import` / `GET /api/export` are the full-fidelity migrate-in / back-up-out endpoints used by the client's "migrate existing site" on-ramp and its Export Data button.
