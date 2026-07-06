<?php

declare(strict_types=1);

namespace EnklWiki\Support;

use PDO;

// Shared read helpers for building the camelCase JSON page-summary shape
// used by GET /api/site, GET/POST/PUT /api/pages*, and GET /api/export —
// avoids repeating the same tag-id join in three controllers.
final class PageRepository
{
    /** @return array<string, string[]> page id => tag ids */
    public static function tagIdsByPage(PDO $db): array
    {
        $stmt = $db->query('SELECT page_id, tag_id FROM page_tags');
        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[$row['page_id']][] = $row['tag_id'];
        }
        return $map;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public static function toSummary(array $row, array $tagIds): array
    {
        return [
            'id' => $row['id'],
            'slug' => $row['slug'],
            'parentId' => $row['parent_id'],
            'title' => $row['title'],
            'tagIds' => $tagIds,
            'archived' => (bool) $row['archived'],
            'createdAt' => Dates::toIso($row['created_at']),
            'updatedAt' => Dates::toIso($row['updated_at']),
        ];
    }

    /** @return array<int, array<string, mixed>> all pages, ordered by sort_order, metadata only */
    public static function allSummaries(PDO $db): array
    {
        $tagIds = self::tagIdsByPage($db);
        $stmt = $db->query('SELECT * FROM pages ORDER BY sort_order');
        return array_map(
            fn (array $row) => self::toSummary($row, $tagIds[$row['id']] ?? []),
            $stmt->fetchAll()
        );
    }

    /** @return array<string, mixed>|null */
    public static function findSummary(PDO $db, string $id): ?array
    {
        $stmt = $db->prepare('SELECT * FROM pages WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        $tagStmt = $db->prepare('SELECT tag_id FROM page_tags WHERE page_id = :id');
        $tagStmt->execute(['id' => $id]);
        return self::toSummary($row, array_column($tagStmt->fetchAll(), 'tag_id'));
    }
}
