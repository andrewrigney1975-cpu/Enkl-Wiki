# Enkl-Wiki API — PHP (non-containerized)

An alternative implementation of Enkl-Wiki's "shared database" backend, for people who'd rather run it on ordinary PHP + PostgreSQL hosting than a .NET/Docker stack. It implements the **exact same HTTP API** as `/server` (the ASP.NET Core version) — same routes, same JSON shapes, same PBKDF2 credential scheme — so the Enkl-Wiki client works with either backend unchanged. Point Site Settings' **API Base URL** at wherever this is deployed and switch storage to *Shared database (via API)*.

This service and its database are both meant to run directly on a server you control — **no containers**. Everything below assumes a plain PHP + PostgreSQL install (a VPS, or shared hosting with PHP-FPM/Apache and a Postgres instance you already have running somewhere).

## Requirements

- PHP 8.1+ with the `pdo_pgsql`, `intl`, and `json` extensions
- [Composer](https://getcomposer.org/)
- A reachable PostgreSQL server (any recent version) — this app only needs a database and a user with rights to it; it doesn't manage the Postgres server itself
- Apache (with `mod_rewrite`) or Nginx

## Setup

```sh
cd server-php
composer install --no-dev
```

1. **Create the schema** against your Postgres database:
   ```sh
   psql "postgresql://USER:PASSWORD@HOST:PORT/DBNAME" -f schema.sql
   ```
2. **Configure the app** — copy `config.example.php` to `config.php` and fill in your database DSN, a JWT signing key (`openssl rand -base64 32`), and the origin(s) your static Enkl-Wiki client is served from (CORS is **deny-by-default** here — cross-origin requests are rejected until you explicitly list an allowed origin). Environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SIGNING_KEY`, `CORS_ALLOWED_ORIGINS`, `UPLOADS_PATH`) work as an alternative to editing `config.php`, if you'd rather set those on the server directly.
3. Make sure the configured uploads directory (`storage/uploads` by default) is writable by the webserver's user. It's created automatically on first upload if missing.
4. The default editor credential (`foobar`, same as every other Enkl-Wiki backing store) is seeded automatically the first time the API receives a request — change it from Site Settings once you've unlocked editing, same as usual.

Only `public/` should be the webserver's document root — everything else (`src/`, `vendor/`, `config.php`, `storage/`) stays outside it, unreachable directly regardless of webserver misconfiguration.

## Webserver configuration

**Apache** — `public/.htaccess` is already set up to rewrite every request through `public/index.php`; just point the vhost's `DocumentRoot` at `server-php/public` and make sure `AllowOverride All` (or at least `FileInfo`) is set for that directory so the `.htaccess` is honored.

**Nginx** example:

```nginx
server {
    listen 80;
    server_name your-api.example.com;
    root /path/to/server-php/public;

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

**Quick local testing**, no webserver install needed — PHP's built-in server needs the front controller passed explicitly as a router script, otherwise it tries to serve any path that looks like it has a file extension (e.g. `/api/uploads/photo.png`) as a literal static file and 404s before your code ever runs:

```sh
php -S localhost:8080 -t public public/index.php
```

## Testing

```sh
composer install
TEST_DB_HOST=localhost TEST_DB_PORT=5432 TEST_DB_NAME=enklwiki_test TEST_DB_USER=... TEST_DB_PASSWORD=... vendor/bin/phpunit
```

Requires a reachable Postgres test database (schema applied the same way as above) — tests truncate its tables before each run, so point this at a throwaway database, not your real one. There's no PHP equivalent of an in-memory database provider worth introducing here; the whole point of this service is a real Postgres server.

## Project layout

```
public/index.php        front controller — CORS, routing, dispatch
public/.htaccess         Apache rewrite-everything-to-index.php
src/Router.php           tiny method+path router, {param} placeholders
src/Request.php          Request.php / Response.php — plain value objects,
src/Response.php           which is what makes controllers unit-testable
                            without a real HTTP server
src/Config.php, Db.php   config loading, PDO connection
src/Cors.php             CORS headers + OPTIONS preflight
src/Auth/                CredentialService (PBKDF2), Jwt (HS256), AuthMiddleware
src/Services/            PageHierarchyService (slug/orphan/reorder), TagService
src/Controllers/         one per resource, mirroring server/EnklWiki.Api/Controllers
src/Support/             shared read helpers (page/upload JSON shaping, date formatting)
schema.sql               DDL — mirrors the .NET service's EF Core migration
tests/                   PHPUnit — Services and Controllers, against a real test DB
```

## Manual verification checklist

With the app running (`php -S` or a real webserver) against a real Postgres database:

1. `GET /health` → `{"status":"ok"}`.
2. Log in (`POST /api/auth/login` with `foobar`), confirm a wrong credential gets 401.
3. Create, edit, reparent (including a rejected cycle), move up/down, archive, and delete (each of the three orphan resolutions) a page — all without a token should 401 on the mutating ones.
4. Upload a file, download it back, confirm its bytes match.
5. `POST /api/import` a full site payload, then `GET /api/export` and confirm every body round-trips byte-for-byte.
6. Change the credential, confirm the old one is rejected and the new one works.
7. Point a locally-served `dist/index.html` (not `file://` — this needs real HTTP for CORS) at this API via Site Settings, with this origin added to `cors.allowedOrigins`, and confirm the existing rdbms-mode UI works end-to-end with zero client code changes. Open a second browser at the same API and confirm both see the same live data.
