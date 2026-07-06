<?php

declare(strict_types=1);

namespace EnklWiki\Controllers;

use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Services\PageHierarchyService;
use EnklWiki\Services\TagService;
use EnklWiki\Support\Dates;
use EnklWiki\Support\PageRepository;
use PDO;

final class PagesController
{
    public function __construct(
        private readonly PDO $db,
        private readonly PageHierarchyService $hierarchy,
        private readonly TagService $tags
    ) {
    }

    public function getAll(Request $request): Response
    {
        return Response::json(PageRepository::allSummaries($this->db));
    }

    public function getOne(Request $request): Response
    {
        $summary = PageRepository::findSummary($this->db, (string) $request->param('id'));
        return $summary === null ? Response::notFound() : Response::json($summary);
    }

    public function getBody(Request $request): Response
    {
        $stmt = $this->db->prepare('SELECT body FROM pages WHERE id = :id');
        $stmt->execute(['id' => $request->param('id')]);
        $body = $stmt->fetchColumn();
        return $body === false ? Response::notFound() : Response::json(['body' => $body]);
    }

    public function putBody(Request $request): Response
    {
        $id = (string) $request->param('id');
        if (!$this->pageExists($id)) {
            return Response::notFound();
        }

        $stmt = $this->db->prepare('UPDATE pages SET body = :body, updated_at = :updatedAt WHERE id = :id');
        $stmt->execute(['body' => (string) $request->json('body', ''), 'updatedAt' => Dates::nowIso(), 'id' => $id]);

        return Response::noContent();
    }

    public function create(Request $request): Response
    {
        $title = trim((string) $request->json('title', ''));
        if ($title === '') {
            return Response::badRequest('Title is required.');
        }

        $parentId = $request->json('parentId');
        if ($parentId !== null && !$this->pageExists((string) $parentId)) {
            return Response::badRequest('parentId does not refer to an existing page.');
        }

        $tagNames = $request->json('tagNames') ?? [];
        $tagIds = $this->tags->resolveTags($tagNames);

        $id = bin2hex(random_bytes(16));
        $slug = $this->hierarchy->uniqueSlug(PageHierarchyService::slugify($title));
        $now = Dates::nowIso();
        $sortOrder = $this->hierarchy->nextSortOrder($parentId);

        $stmt = $this->db->prepare(
            'INSERT INTO pages (id, slug, parent_id, title, archived, sort_order, body, created_at, updated_at)
             VALUES (:id, :slug, :parentId, :title, false, :sortOrder, \'\', :createdAt, :updatedAt)'
        );
        $stmt->execute([
            'id' => $id, 'slug' => $slug, 'parentId' => $parentId, 'title' => $title,
            'sortOrder' => $sortOrder, 'createdAt' => $now, 'updatedAt' => $now,
        ]);
        $this->attachTags($id, $tagIds);

        return Response::json(PageRepository::findSummary($this->db, $id), 201);
    }

    public function updateMetadata(Request $request): Response
    {
        $title = trim((string) $request->json('title', ''));
        if ($title === '') {
            return Response::badRequest('Title is required.');
        }

        $id = (string) $request->param('id');
        if (!$this->pageExists($id)) {
            return Response::notFound();
        }

        $tagIds = $this->tags->resolveTags($request->json('tagNames') ?? []);

        $stmt = $this->db->prepare('UPDATE pages SET title = :title, updated_at = :updatedAt WHERE id = :id');
        $stmt->execute(['title' => $title, 'updatedAt' => Dates::nowIso(), 'id' => $id]);
        $this->attachTags($id, $tagIds, replace: true);

        return Response::noContent();
    }

    public function reparent(Request $request): Response
    {
        $id = (string) $request->param('id');
        if (!$this->pageExists($id)) {
            return Response::notFound();
        }

        $newParentId = $request->json('newParentId');
        if ($newParentId !== null) {
            if (!$this->pageExists((string) $newParentId)) {
                return Response::badRequest('newParentId does not refer to an existing page.');
            }
            if ($this->hierarchy->wouldCreateCycle($id, (string) $newParentId)) {
                return Response::badRequest('That move would create a cycle in the page hierarchy.');
            }
        }

        $stmt = $this->db->prepare('UPDATE pages SET parent_id = :parentId, sort_order = :sortOrder, updated_at = :updatedAt WHERE id = :id');
        $stmt->execute([
            'parentId' => $newParentId,
            'sortOrder' => $this->hierarchy->nextSortOrder($newParentId),
            'updatedAt' => Dates::nowIso(),
            'id' => $id,
        ]);

        return Response::noContent();
    }

    public function move(Request $request): Response
    {
        $direction = $request->json('direction');
        if (!in_array($direction, ['up', 'down'], true)) {
            return Response::badRequest("direction must be 'up' or 'down'.");
        }

        $id = (string) $request->param('id');
        if (!$this->pageExists($id)) {
            return Response::notFound();
        }

        $this->hierarchy->moveSibling($id, $direction);
        return Response::noContent();
    }

    public function setArchived(Request $request): Response
    {
        $id = (string) $request->param('id');
        if (!$this->pageExists($id)) {
            return Response::notFound();
        }

        $stmt = $this->db->prepare('UPDATE pages SET archived = :archived, updated_at = :updatedAt WHERE id = :id');
        // Bound as an int — see the comment in ImportExportController::import
        // about PDO::ATTR_EMULATE_PREPARES quoting bool false as ''.
        $stmt->execute(['archived' => (int) (bool) $request->json('archived', false), 'updatedAt' => Dates::nowIso(), 'id' => $id]);

        return Response::noContent();
    }

    public function delete(Request $request): Response
    {
        $id = (string) $request->param('id');
        if (!$this->pageExists($id)) {
            return Response::notFound();
        }

        $type = $request->json('type', 'cascade');
        if (!in_array($type, ['cascade', 'repoint', 'promote'], true)) {
            return Response::badRequest("resolution.type must be 'cascade', 'repoint' or 'promote'.");
        }

        $newParentId = $request->json('newParentId');
        if ($type === 'repoint' && $newParentId === null) {
            return Response::badRequest("resolution.newParentId is required for 'repoint'.");
        }

        $this->hierarchy->deletePageWithChildren($id, $type, $newParentId === null ? null : (string) $newParentId);
        return Response::noContent();
    }

    private function pageExists(string $id): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM pages WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetchColumn() !== false;
    }

    /** @param string[] $tagIds */
    private function attachTags(string $pageId, array $tagIds, bool $replace = false): void
    {
        if ($replace) {
            $del = $this->db->prepare('DELETE FROM page_tags WHERE page_id = :pageId');
            $del->execute(['pageId' => $pageId]);
        }
        $insert = $this->db->prepare('INSERT INTO page_tags (page_id, tag_id) VALUES (:pageId, :tagId)');
        foreach ($tagIds as $tagId) {
            $insert->execute(['pageId' => $pageId, 'tagId' => $tagId]);
        }
    }
}
