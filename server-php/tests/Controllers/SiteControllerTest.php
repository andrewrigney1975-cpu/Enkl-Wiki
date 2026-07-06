<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Controllers;

use EnklWiki\Auth\CredentialService;
use EnklWiki\Controllers\SiteController;
use EnklWiki\Request;
use EnklWiki\Tests\TestCase;

final class SiteControllerTest extends TestCase
{
    private function controller(): SiteController
    {
        return new SiteController($this->db, new CredentialService());
    }

    public function testGetReturnsTheSeededEmptySite(): void
    {
        $response = $this->controller()->get(new Request('GET', '/api/site'));

        self::assertSame(200, $response->status);
        self::assertSame('Enkl-Wiki', $response->body['title']);
        self::assertSame([], $response->body['pages']);
        self::assertSame([], $response->body['tags']);
        self::assertSame([], $response->body['uploads']);
    }

    public function testUpdateChangesTitleAndDescription(): void
    {
        $controller = $this->controller();
        $update = $controller->update(new Request('PUT', '/api/site', jsonBody: ['title' => 'My Wiki', 'description' => 'desc']));
        self::assertSame(204, $update->status);

        $get = $controller->get(new Request('GET', '/api/site'));
        self::assertSame('My Wiki', $get->body['title']);
        self::assertSame('desc', $get->body['description']);
    }

    public function testChangeCredentialTakesEffectForTheNextLogin(): void
    {
        $credentials = new CredentialService();
        $seed = $credentials->hash('foobar');
        $this->db->prepare('UPDATE sites SET credential_salt = :salt, credential_hash = :hash WHERE id = 1')->execute($seed);

        $controller = $this->controller();
        $response = $controller->changeCredential(new Request('PUT', '/api/site/credential', jsonBody: ['newCredential' => 'newpass123']));
        self::assertSame(204, $response->status);

        $row = $this->db->query('SELECT credential_salt, credential_hash FROM sites WHERE id = 1')->fetch();
        self::assertTrue($credentials->verify('newpass123', $row['credential_salt'], $row['credential_hash']));
        self::assertFalse($credentials->verify('foobar', $row['credential_salt'], $row['credential_hash']));
    }

    public function testChangeCredentialRejectsAnEmptyNewCredential(): void
    {
        $response = $this->controller()->changeCredential(new Request('PUT', '/api/site/credential', jsonBody: ['newCredential' => '']));
        self::assertSame(400, $response->status);
    }
}
