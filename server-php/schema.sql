-- Enkl-Wiki PHP API — PostgreSQL schema.
-- Mirrors the .NET service's EF Core migration (server/EnklWiki.Api) so
-- both implementations agree on the same shape, field-for-field.
-- Run once against a database the API's DB user can read/write:
--   psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Enkl-Wiki',
    description TEXT NOT NULL DEFAULT '',
    credential_salt TEXT,
    credential_hash TEXT
);

-- Separate admin credential — unlocks everything the editor credential does,
-- plus Site Settings (title/description, either credential, tag pruning, and
-- import). Added via ALTER rather than inline in CREATE TABLE so re-running
-- this script against an already-provisioned database upgrades it in place.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS admin_credential_salt TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS admin_credential_hash TEXT;

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    parent_id TEXT REFERENCES pages (id),
    title TEXT NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages (parent_id);

CREATE TABLE IF NOT EXISTS page_tags (
    page_id TEXT NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (page_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_page_tags_tag_id ON page_tags (tag_id);

CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL UNIQUE,
    original_file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Single-tenant: exactly one row, fixed id = 1. Credential is seeded
-- (default "foobar", hashed) by the application on first request, not here.
INSERT INTO sites (id, title, description)
VALUES (1, 'Enkl-Wiki', '')
ON CONFLICT (id) DO NOTHING;
