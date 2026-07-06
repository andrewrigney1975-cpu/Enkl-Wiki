<?php

declare(strict_types=1);

namespace EnklWiki\Tests;

use EnklWiki\Db;
use PDO;
use PHPUnit\Framework\TestCase as BaseTestCase;

// Tests run against a real (non-containerized-from-PHPUnit's perspective —
// however the operator happens to run it) Postgres test database, per the
// plan: there's no PHP equivalent of EF Core's InMemory provider worth
// introducing, and the whole point of this service is a real Postgres
// server. Point TEST_DATABASE_* env vars at a throwaway database; tables
// are truncated before every test for isolation.
abstract class TestCase extends BaseTestCase
{
    protected PDO $db;

    protected function setUp(): void
    {
        parent::setUp();

        $this->db = Db::connect([
            'host' => getenv('TEST_DB_HOST') ?: '127.0.0.1',
            'port' => (int) (getenv('TEST_DB_PORT') ?: 5433),
            'database' => getenv('TEST_DB_NAME') ?: 'enklwiki_php_test',
            'username' => getenv('TEST_DB_USER') ?: 'enklwiki',
            'password' => getenv('TEST_DB_PASSWORD') ?: 'enklwiki-dev',
        ]);

        $this->db->exec('TRUNCATE pages, tags, page_tags, uploads RESTART IDENTITY CASCADE');
        $this->db->exec("UPDATE sites SET title = 'Enkl-Wiki', description = '', credential_salt = NULL, credential_hash = NULL WHERE id = 1");
    }

    protected function insertPage(
        string $id,
        string $slug,
        ?string $parentId = null,
        string $title = 'Untitled',
        int $sortOrder = 0,
        bool $archived = false,
        string $body = ''
    ): void {
        $now = date('c');
        $stmt = $this->db->prepare(
            'INSERT INTO pages (id, slug, parent_id, title, archived, sort_order, body, created_at, updated_at)
             VALUES (:id, :slug, :parentId, :title, :archived, :sortOrder, :body, :now, :now)'
        );
        $stmt->execute([
            'id' => $id, 'slug' => $slug, 'parentId' => $parentId, 'title' => $title,
            'archived' => (int) $archived, 'sortOrder' => $sortOrder, 'body' => $body, 'now' => $now,
        ]);
    }
}
