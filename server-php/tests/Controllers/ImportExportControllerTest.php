<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Controllers;

use EnklWiki\Controllers\ImportExportController;
use EnklWiki\Request;
use EnklWiki\Tests\TestCase;

final class ImportExportControllerTest extends TestCase
{
    public function testImportRejectsAMissingSiteTitle(): void
    {
        $response = (new ImportExportController($this->db))->import(new Request('POST', '/api/import', jsonBody: [
            'site' => ['title' => ''], 'tags' => [], 'pages' => [],
        ]));
        self::assertSame(400, $response->status);
    }

    public function testImportRejectsAPageWhoseParentIdIsNotInThePayload(): void
    {
        $response = (new ImportExportController($this->db))->import(new Request('POST', '/api/import', jsonBody: [
            'site' => ['title' => 'X'], 'tags' => [],
            'pages' => [['id' => 'p1', 'slug' => 'p1', 'parentId' => 'missing', 'title' => 'P1', 'tagIds' => [], 'archived' => false]],
        ]));
        self::assertSame(400, $response->status);
    }

    public function testImportReplacesAllPagesAndTagsThenExportReturnsFullFidelityBodies(): void
    {
        $controller = new ImportExportController($this->db);

        $import = $controller->import(new Request('POST', '/api/import', jsonBody: [
            'site' => ['title' => 'Imported Site', 'description' => 'from a test'],
            'tags' => [['id' => 't1', 'name' => 'guide']],
            'pages' => [[
                'id' => 'p1', 'slug' => 'home', 'parentId' => null, 'title' => 'Home',
                'tagIds' => ['t1'], 'archived' => false, 'body' => '# Home body',
            ]],
        ]));
        self::assertSame(204, $import->status);

        $export = $controller->export(new Request('GET', '/api/export'));
        self::assertSame('Imported Site', $export->body['site']['title']);
        self::assertCount(1, $export->body['pages']);
        self::assertSame('# Home body', $export->body['pages'][0]['body']);
        self::assertSame(['t1'], $export->body['pages'][0]['tagIds']);
        self::assertFalse($export->body['pages'][0]['archived']);
    }

    public function testImportPreservesAnArchivedTrueFlag(): void
    {
        $controller = new ImportExportController($this->db);
        $controller->import(new Request('POST', '/api/import', jsonBody: [
            'site' => ['title' => 'X'], 'tags' => [],
            'pages' => [['id' => 'p1', 'slug' => 'p1', 'parentId' => null, 'title' => 'P1', 'tagIds' => [], 'archived' => true]],
        ]));

        $export = $controller->export(new Request('GET', '/api/export'));
        self::assertTrue($export->body['pages'][0]['archived']);
    }

    public function testImportIsReplaceAllNotMerge(): void
    {
        $this->insertPage('old', 'old');
        $controller = new ImportExportController($this->db);

        $controller->import(new Request('POST', '/api/import', jsonBody: [
            'site' => ['title' => 'X'], 'tags' => [],
            'pages' => [['id' => 'new', 'slug' => 'new', 'parentId' => null, 'title' => 'New', 'tagIds' => [], 'archived' => false]],
        ]));

        $ids = array_column($this->db->query('SELECT id FROM pages')->fetchAll(), 'id');
        self::assertSame(['new'], $ids);
    }
}
