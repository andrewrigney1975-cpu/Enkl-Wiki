<?php

declare(strict_types=1);

namespace EnklWiki\Services;

use PDO;

final class TagService
{
    public function __construct(private readonly PDO $db)
    {
    }

    public static function normalizeTagName(string $raw): string
    {
        $trimmed = trim($raw);
        $withoutHash = preg_replace('/^#/', '', $trimmed) ?? $trimmed;
        $dashed = preg_replace('/\s+/', '-', $withoutHash) ?? $withoutHash;
        return mb_strtolower($dashed, 'UTF-8');
    }

    /**
     * Resolves a list of raw tag names (as typed by an editor) to tag ids,
     * creating any that don't already exist by name — mirrors the client's
     * findOrCreateTag (src/content/tag-model.js).
     *
     * @param string[] $rawNames
     * @return string[] tag ids
     */
    public function resolveTags(array $rawNames): array
    {
        $normalized = array_values(array_unique(array_filter(array_map(self::normalizeTagName(...), $rawNames))));
        if ($normalized === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($normalized), '?'));
        $stmt = $this->db->prepare("SELECT id, name FROM tags WHERE name IN ($placeholders)");
        $stmt->execute($normalized);
        $existing = $stmt->fetchAll();

        $idByName = [];
        foreach ($existing as $row) {
            $idByName[$row['name']] = $row['id'];
        }

        $insert = $this->db->prepare('INSERT INTO tags (id, name) VALUES (:id, :name)');
        $ids = [];
        foreach ($normalized as $name) {
            if (isset($idByName[$name])) {
                $ids[] = $idByName[$name];
                continue;
            }
            $newId = self::generateId();
            $insert->execute(['id' => $newId, 'name' => $name]);
            $ids[] = $newId;
        }
        return $ids;
    }

    // Tags no longer referenced by any page — safe to drop from the registry.
    public function removeUnusedTags(): int
    {
        $stmt = $this->db->query(
            'SELECT t.id FROM tags t LEFT JOIN page_tags pt ON pt.tag_id = t.id WHERE pt.tag_id IS NULL'
        );
        $unusedIds = array_column($stmt->fetchAll(), 'id');
        if ($unusedIds === []) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($unusedIds), '?'));
        $del = $this->db->prepare("DELETE FROM tags WHERE id IN ($placeholders)");
        $del->execute($unusedIds);
        return count($unusedIds);
    }

    public static function generateId(): string
    {
        return bin2hex(random_bytes(16));
    }
}
