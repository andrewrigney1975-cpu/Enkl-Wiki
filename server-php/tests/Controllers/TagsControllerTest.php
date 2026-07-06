<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Controllers;

use EnklWiki\Controllers\TagsController;
use EnklWiki\Request;
use EnklWiki\Services\TagService;
use EnklWiki\Tests\TestCase;

final class TagsControllerTest extends TestCase
{
    public function testDeleteUnusedRemovesOnlyTagsNoPageReferences(): void
    {
        $tagService = new TagService($this->db);
        $usedId = $tagService->resolveTags(['used'])[0];
        $tagService->resolveTags(['unused']);
        $this->insertPage('p1', 'p1');
        $this->db->prepare('INSERT INTO page_tags (page_id, tag_id) VALUES (:pageId, :tagId)')->execute(['pageId' => 'p1', 'tagId' => $usedId]);

        $response = (new TagsController($tagService))->deleteUnused(new Request('DELETE', '/api/tags/unused'));

        self::assertSame(200, $response->status);
        self::assertSame(['removed' => 1], $response->body);
    }
}
