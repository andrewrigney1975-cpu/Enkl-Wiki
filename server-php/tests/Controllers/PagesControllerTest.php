<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Controllers;

use EnklWiki\Controllers\PagesController;
use EnklWiki\Request;
use EnklWiki\Services\PageHierarchyService;
use EnklWiki\Services\TagService;
use EnklWiki\Tests\TestCase;

final class PagesControllerTest extends TestCase
{
    private function controller(): PagesController
    {
        return new PagesController($this->db, new PageHierarchyService($this->db), new TagService($this->db));
    }

    public function testCreateRejectsABlankTitle(): void
    {
        $response = $this->controller()->create(new Request('POST', '/api/pages', jsonBody: ['title' => '  ']));
        self::assertSame(400, $response->status);
    }

    public function testCreateThenGetOneReturnsTheNewPage(): void
    {
        $controller = $this->controller();
        $created = $controller->create(new Request('POST', '/api/pages', jsonBody: [
            'title' => 'Getting Started', 'tagNames' => ['guide', 'intro'],
        ]));

        self::assertSame(201, $created->status);
        self::assertSame('getting-started', $created->body['slug']);
        self::assertCount(2, $created->body['tagIds']);

        $fetched = $controller->getOne(new Request('GET', '/api/pages/' . $created->body['id'], params: ['id' => $created->body['id']]));
        self::assertSame(200, $fetched->status);
        self::assertSame('Getting Started', $fetched->body['title']);
    }

    public function testCreateRejectsAParentIdThatDoesNotExist(): void
    {
        $response = $this->controller()->create(new Request('POST', '/api/pages', jsonBody: ['title' => 'X', 'parentId' => 'missing']));
        self::assertSame(400, $response->status);
    }

    public function testBodyRoundTrips(): void
    {
        $this->insertPage('p1', 'p1');
        $controller = $this->controller();

        $put = $controller->putBody(new Request('PUT', '/api/pages/p1/body', params: ['id' => 'p1'], jsonBody: ['body' => '# Hello']));
        self::assertSame(204, $put->status);

        $got = $controller->getBody(new Request('GET', '/api/pages/p1/body', params: ['id' => 'p1']));
        self::assertSame(['body' => '# Hello'], $got->body);
    }

    public function testGetBodyReturns404ForAMissingPage(): void
    {
        $response = $this->controller()->getBody(new Request('GET', '/api/pages/missing/body', params: ['id' => 'missing']));
        self::assertSame(404, $response->status);
    }

    public function testUpdateMetadataReplacesTitleAndTags(): void
    {
        $this->insertPage('p1', 'p1', title: 'Old');
        $controller = $this->controller();

        $response = $controller->updateMetadata(new Request('PUT', '/api/pages/p1', params: ['id' => 'p1'], jsonBody: [
            'title' => 'New Title', 'tagNames' => ['x'],
        ]));

        self::assertSame(204, $response->status);
        $fetched = $controller->getOne(new Request('GET', '/api/pages/p1', params: ['id' => 'p1']));
        self::assertSame('New Title', $fetched->body['title']);
        self::assertCount(1, $fetched->body['tagIds']);
    }

    public function testReparentRejectsAMoveThatWouldCreateACycle(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');
        $controller = $this->controller();

        $response = $controller->reparent(new Request('PUT', '/api/pages/root/parent', params: ['id' => 'root'], jsonBody: ['newParentId' => 'child']));

        self::assertSame(400, $response->status);
    }

    public function testReparentToNullMakesAPageTopLevel(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');
        $controller = $this->controller();

        $response = $controller->reparent(new Request('PUT', '/api/pages/child/parent', params: ['id' => 'child'], jsonBody: ['newParentId' => null]));

        self::assertSame(204, $response->status);
        $fetched = $controller->getOne(new Request('GET', '/api/pages/child', params: ['id' => 'child']));
        self::assertNull($fetched->body['parentId']);
    }

    public function testMoveRejectsAnInvalidDirection(): void
    {
        $this->insertPage('p1', 'p1');
        $response = $this->controller()->move(new Request('PUT', '/api/pages/p1/move', params: ['id' => 'p1'], jsonBody: ['direction' => 'sideways']));
        self::assertSame(400, $response->status);
    }

    public function testSetArchivedTogglesTheFlag(): void
    {
        $this->insertPage('p1', 'p1');
        $controller = $this->controller();

        $response = $controller->setArchived(new Request('PUT', '/api/pages/p1/archived', params: ['id' => 'p1'], jsonBody: ['archived' => true]));
        self::assertSame(204, $response->status);

        $fetched = $controller->getOne(new Request('GET', '/api/pages/p1', params: ['id' => 'p1']));
        self::assertTrue($fetched->body['archived']);
    }

    public function testDeleteWithPromoteResolutionMakesTheTopMostChildTopLevel(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');
        $controller = $this->controller();

        $response = $controller->delete(new Request('DELETE', '/api/pages/root', params: ['id' => 'root'], jsonBody: ['type' => 'promote']));

        self::assertSame(204, $response->status);
        self::assertSame(404, $controller->getOne(new Request('GET', '/api/pages/root', params: ['id' => 'root']))->status);
        $child = $controller->getOne(new Request('GET', '/api/pages/child', params: ['id' => 'child']));
        self::assertNull($child->body['parentId']);
    }

    public function testDeleteRequiresNewParentIdForRepointResolution(): void
    {
        $this->insertPage('root', 'root');
        $this->insertPage('child', 'child', parentId: 'root');

        $response = $this->controller()->delete(new Request('DELETE', '/api/pages/root', params: ['id' => 'root'], jsonBody: ['type' => 'repoint']));

        self::assertSame(400, $response->status);
    }

    public function testGetAllOrdersBySortOrder(): void
    {
        $this->insertPage('b', 'b', sortOrder: 1);
        $this->insertPage('a', 'a', sortOrder: 0);

        $response = $this->controller()->getAll(new Request('GET', '/api/pages'));

        self::assertSame(['a', 'b'], array_column($response->body, 'id'));
    }
}
