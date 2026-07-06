<?php

declare(strict_types=1);

namespace EnklWiki\Controllers;

use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Support\Dates;
use EnklWiki\Support\PageRepository;
use EnklWiki\Support\UploadRepository;
use PDO;

final class ImportExportController
{
    public function __construct(private readonly PDO $db)
    {
    }

    // Full-fidelity backup: unlike the client's own exportConfig() (which can
    // only serialize page bodies currently loaded in memory), every page's
    // body is already in the DB, so this always inlines everything.
    public function export(Request $request): Response
    {
        $site = $this->db->query('SELECT title, description FROM sites WHERE id = 1')->fetch();
        if ($site === false) {
            return Response::notFound();
        }

        $tags = $this->db->query('SELECT id, name FROM tags')->fetchAll();
        $tagIdsByPage = PageRepository::tagIdsByPage($this->db);
        $pages = $this->db->query('SELECT * FROM pages ORDER BY sort_order')->fetchAll();
        $uploads = $this->db->query('SELECT * FROM uploads')->fetchAll();

        return Response::json([
            'site' => ['title' => $site['title'], 'description' => $site['description']],
            'tags' => $tags,
            'pages' => array_map(
                fn (array $p) => [
                    'id' => $p['id'], 'slug' => $p['slug'], 'parentId' => $p['parent_id'], 'title' => $p['title'],
                    'tagIds' => $tagIdsByPage[$p['id']] ?? [], 'archived' => (bool) $p['archived'], 'body' => $p['body'],
                    'createdAt' => Dates::toIso($p['created_at']), 'updatedAt' => Dates::toIso($p['updated_at']),
                ],
                $pages
            ),
            'uploads' => array_map(UploadRepository::toDto(...), $uploads),
        ]);
    }

    // Replace-all: mirrors the client's replaceConfig(), used as the on-ramp
    // for migrating an existing embedded/filesystem site into rdbms mode.
    // Tags and pages are fully replaced; uploads are left untouched since no
    // binary content travels in this JSON payload (existing embedded/
    // filesystem uploads referenced by imported pages must be re-uploaded).
    public function import(Request $request): Response
    {
        $site = $request->json('site');
        $title = is_array($site) ? trim((string) ($site['title'] ?? '')) : '';
        if ($title === '') {
            return Response::badRequest('site.title is required.');
        }

        $pages = $request->json('pages') ?? [];
        $incomingIds = array_column($pages, 'id');
        foreach ($pages as $p) {
            $parentId = $p['parentId'] ?? null;
            if ($parentId !== null && !in_array($parentId, $incomingIds, true)) {
                return Response::badRequest("Page '{$p['id']}' has parentId '$parentId' which is not present in the import payload.");
            }
        }

        $this->db->beginTransaction();
        try {
            $this->db->exec('DELETE FROM pages');
            $this->db->exec('DELETE FROM tags');

            $tagsPayload = $request->json('tags') ?? [];
            $validTagIds = [];
            $insertTag = $this->db->prepare('INSERT INTO tags (id, name) VALUES (:id, :name)');
            foreach ($tagsPayload as $tag) {
                $tagId = (string) ($tag['id'] ?? '');
                if ($tagId === '' || isset($validTagIds[$tagId])) {
                    continue; // skip duplicates/blank ids, same as the .NET GroupBy-first behavior
                }
                $validTagIds[$tagId] = true;
                $insertTag->execute(['id' => $tagId, 'name' => (string) ($tag['name'] ?? '')]);
            }

            $now = Dates::nowIso();
            $sortOrders = [];
            $insertPage = $this->db->prepare(
                'INSERT INTO pages (id, slug, parent_id, title, archived, sort_order, body, created_at, updated_at)
                 VALUES (:id, :slug, :parentId, :title, :archived, :sortOrder, :body, :createdAt, :updatedAt)'
            );
            $insertPageTag = $this->db->prepare('INSERT INTO page_tags (page_id, tag_id) VALUES (:pageId, :tagId)');

            foreach ($pages as $p) {
                $parentKey = $p['parentId'] ?? '';
                $sortOrders[$parentKey] = ($sortOrders[$parentKey] ?? -1) + 1;

                $insertPage->execute([
                    'id' => $p['id'], 'slug' => $p['slug'], 'parentId' => $p['parentId'] ?? null,
                    // Bound as an int, not a PHP bool: with PDO::ATTR_EMULATE_PREPARES
                    // (required elsewhere for nullable-parameter type inference — see
                    // Db.php), PDO quotes bool false as an empty string, which Postgres
                    // then rejects as an invalid boolean literal.
                    'title' => $p['title'], 'archived' => (int) (bool) ($p['archived'] ?? false),
                    'sortOrder' => $sortOrders[$parentKey], 'body' => $p['body'] ?? '',
                    'createdAt' => $p['createdAt'] ?? $now, 'updatedAt' => $p['updatedAt'] ?? $now,
                ]);

                foreach ($p['tagIds'] ?? [] as $tagId) {
                    if (isset($validTagIds[$tagId])) {
                        $insertPageTag->execute(['pageId' => $p['id'], 'tagId' => $tagId]);
                    }
                }
            }

            $updateSite = $this->db->prepare('UPDATE sites SET title = :title, description = :description WHERE id = 1');
            $updateSite->execute(['title' => $title, 'description' => (string) ($site['description'] ?? '')]);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return Response::noContent();
    }
}
