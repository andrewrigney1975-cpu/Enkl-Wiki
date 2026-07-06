<?php

declare(strict_types=1);

namespace EnklWiki\Controllers;

use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Services\TagService;

final class TagsController
{
    public function __construct(private readonly TagService $tags)
    {
    }

    public function deleteUnused(Request $request): Response
    {
        $removed = $this->tags->removeUnusedTags();
        return Response::json(['removed' => $removed]);
    }
}
