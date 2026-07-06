<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Services;

use EnklWiki\Services\TagService;
use EnklWiki\Tests\TestCase;

final class TagServiceTest extends TestCase
{
    /** @dataProvider normalizeExamples */
    public function testNormalizeTagName(string $input, string $expected): void
    {
        self::assertSame($expected, TagService::normalizeTagName($input));
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function normalizeExamples(): array
    {
        return [
            'strips hash' => ['#Guide', 'guide'],
            'dashes whitespace' => ['  Getting Started  ', 'getting-started'],
            'already normalized' => ['ALREADY-normalized', 'already-normalized'],
        ];
    }

    public function testResolveTagsReusesAnExistingTagByNormalizedName(): void
    {
        $existingId = TagService::generateId();
        $this->db->prepare('INSERT INTO tags (id, name) VALUES (:id, :name)')->execute(['id' => $existingId, 'name' => 'guide']);

        $service = new TagService($this->db);
        $ids = $service->resolveTags(['#Guide']);

        self::assertSame([$existingId], $ids);
        self::assertSame(1, (int) $this->db->query('SELECT COUNT(*) FROM tags')->fetchColumn());
    }

    public function testResolveTagsCreatesNewTagsAndDedupesByNormalizedName(): void
    {
        $service = new TagService($this->db);
        $ids = $service->resolveTags(['Alpha', 'alpha', 'Beta']);

        self::assertCount(2, $ids);
        self::assertSame(2, (int) $this->db->query('SELECT COUNT(*) FROM tags')->fetchColumn());
    }

    public function testRemoveUnusedTagsRemovesOnlyTagsWithNoPages(): void
    {
        $usedId = TagService::generateId();
        $unusedId = TagService::generateId();
        $this->db->prepare('INSERT INTO tags (id, name) VALUES (:id, :name)')->execute(['id' => $usedId, 'name' => 'used']);
        $this->db->prepare('INSERT INTO tags (id, name) VALUES (:id, :name)')->execute(['id' => $unusedId, 'name' => 'unused']);
        $this->insertPage('p1', 'p1');
        $this->db->prepare('INSERT INTO page_tags (page_id, tag_id) VALUES (:pageId, :tagId)')->execute(['pageId' => 'p1', 'tagId' => $usedId]);

        $removed = (new TagService($this->db))->removeUnusedTags();

        self::assertSame(1, $removed);
        self::assertSame([$usedId], array_column($this->db->query('SELECT id FROM tags')->fetchAll(), 'id'));
    }
}
