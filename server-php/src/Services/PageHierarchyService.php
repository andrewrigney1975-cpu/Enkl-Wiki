<?php

declare(strict_types=1);

namespace EnklWiki\Services;

use Normalizer;
use PDO;

// Ports the slug/orphan/reorder semantics from the client's
// src/content/page-model.js (and the .NET PageHierarchyService.cs port of
// the same) so all three backing stores behave identically.
final class PageHierarchyService
{
    public function __construct(private readonly PDO $db)
    {
    }

    public static function slugify(?string $text): string
    {
        $text = mb_strtolower($text ?? '', 'UTF-8');
        $normalized = Normalizer::normalize($text, Normalizer::FORM_KD) ?: $text;
        // Strip combining diacritical marks left behind by NFKD decomposition.
        $stripped = preg_replace('/\p{Mn}+/u', '', $normalized) ?? $normalized;
        $slug = preg_replace('/[^a-z0-9]+/', '-', $stripped) ?? '';
        $slug = trim($slug, '-');
        return mb_substr($slug, 0, 80);
    }

    public function uniqueSlug(string $baseSlug, ?string $excludePageId = null): string
    {
        $candidate = $baseSlug === '' ? 'page' : $baseSlug;
        if (!$this->slugExists($candidate, $excludePageId)) {
            return $candidate;
        }

        $i = 2;
        while ($this->slugExists("$candidate-$i", $excludePageId)) {
            $i++;
        }
        return "$candidate-$i";
    }

    private function slugExists(string $slug, ?string $excludePageId): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM pages WHERE slug = :slug AND (:excludeId IS NULL OR id != :excludeId)');
        $stmt->execute(['slug' => $slug, 'excludeId' => $excludePageId]);
        return $stmt->fetchColumn() !== false;
    }

    /** @return string[] every descendant id (children, grandchildren, ...) of $pageId, flattened */
    public function getDescendantIds(string $pageId): array
    {
        $stmt = $this->db->query('SELECT id, parent_id FROM pages');
        $allPages = $stmt->fetchAll();

        $childrenByParent = [];
        foreach ($allPages as $row) {
            $childrenByParent[$row['parent_id'] ?? ''][] = $row['id'];
        }

        $result = [];
        $stack = [$pageId];
        while ($stack) {
            $current = array_pop($stack);
            foreach ($childrenByParent[$current] ?? [] as $childId) {
                $result[] = $childId;
                $stack[] = $childId;
            }
        }
        return $result;
    }

    // True if $candidateParentId is $pageId itself or one of its
    // descendants — reparenting onto one of these would create a cycle.
    public function wouldCreateCycle(string $pageId, string $candidateParentId): bool
    {
        if ($pageId === $candidateParentId) {
            return true;
        }
        return in_array($candidateParentId, $this->getDescendantIds($pageId), true);
    }

    // Swaps $pageId with its previous/next sibling (shared parent_id) by
    // sort_order. No-op at either end of the sibling list.
    public function moveSibling(string $pageId, string $direction): void
    {
        $page = $this->fetchPage($pageId);
        if ($page === null) {
            throw new \RuntimeException("Page not found: $pageId");
        }

        $stmt = $this->db->prepare(
            'SELECT id, sort_order FROM pages WHERE (parent_id = :parentId) OR (:parentId IS NULL AND parent_id IS NULL) ORDER BY sort_order'
        );
        $stmt->execute(['parentId' => $page['parent_id']]);
        $siblings = $stmt->fetchAll();

        $index = null;
        foreach ($siblings as $i => $sibling) {
            if ($sibling['id'] === $pageId) {
                $index = $i;
                break;
            }
        }
        if ($index === null) {
            return;
        }

        $swapWith = $direction === 'up' ? $index - 1 : $index + 1;
        if ($swapWith < 0 || $swapWith >= count($siblings)) {
            return;
        }

        $update = $this->db->prepare('UPDATE pages SET sort_order = :sortOrder WHERE id = :id');
        $update->execute(['sortOrder' => $siblings[$swapWith]['sort_order'], 'id' => $siblings[$index]['id']]);
        $update->execute(['sortOrder' => $siblings[$index]['sort_order'], 'id' => $siblings[$swapWith]['id']]);
    }

    public function nextSortOrder(?string $parentId): int
    {
        $stmt = $this->db->prepare(
            'SELECT MAX(sort_order) AS max_sort FROM pages WHERE (parent_id = :parentId) OR (:parentId IS NULL AND parent_id IS NULL)'
        );
        $stmt->execute(['parentId' => $parentId]);
        $max = $stmt->fetchColumn();
        return $max === null || $max === false ? 0 : ((int) $max) + 1;
    }

    /**
     * Deletes $pageId. If it has children, $resolutionType decides their fate:
     *  - "cascade": the page and all descendants are removed.
     *  - "repoint": the top-most child is reparented to $newParentId; any
     *    other direct children are nested under that child.
     *  - "promote": the top-most child becomes top-level; any other direct
     *    children are nested under that child.
     */
    public function deletePageWithChildren(string $pageId, string $resolutionType, ?string $newParentId): void
    {
        $stmt = $this->db->prepare('SELECT id FROM pages WHERE parent_id = :parentId ORDER BY sort_order');
        $stmt->execute(['parentId' => $pageId]);
        $children = array_column($stmt->fetchAll(), 'id');

        if (count($children) === 0 || $resolutionType === 'cascade') {
            $toRemove = array_merge([$pageId], $this->getDescendantIds($pageId));
            $placeholders = implode(',', array_fill(0, count($toRemove), '?'));
            $del = $this->db->prepare("DELETE FROM pages WHERE id IN ($placeholders)");
            $del->execute($toRemove);
            return;
        }

        $topMostId = $children[0];
        $newTopMostParent = $resolutionType === 'repoint' ? $newParentId : null;
        $update = $this->db->prepare('UPDATE pages SET parent_id = :parentId WHERE id = :id');
        $update->execute(['parentId' => $newTopMostParent, 'id' => $topMostId]);

        foreach (array_slice($children, 1) as $childId) {
            $update->execute(['parentId' => $topMostId, 'id' => $childId]);
        }

        $del = $this->db->prepare('DELETE FROM pages WHERE id = :id');
        $del->execute(['id' => $pageId]);
    }

    /** @return array<string, mixed>|null */
    private function fetchPage(string $pageId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM pages WHERE id = :id');
        $stmt->execute(['id' => $pageId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }
}
