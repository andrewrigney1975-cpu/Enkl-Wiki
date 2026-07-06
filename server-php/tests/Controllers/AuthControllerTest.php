<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Controllers;

use EnklWiki\Auth\CredentialService;
use EnklWiki\Auth\Jwt;
use EnklWiki\Controllers\AuthController;
use EnklWiki\Request;
use EnklWiki\Tests\TestCase;

final class AuthControllerTest extends TestCase
{
    private function controller(): AuthController
    {
        return new AuthController($this->db, new CredentialService(), new Jwt('test-signing-key-at-least-32-bytes-long!!'));
    }

    public function testLoginFailsWithFiveHundredWhenNoCredentialIsConfiguredYet(): void
    {
        $response = $this->controller()->login(new Request('POST', '/api/auth/login', jsonBody: ['credential' => 'foobar']));
        self::assertSame(500, $response->status);
    }

    public function testLoginSucceedsWithTheConfiguredCredentialAndReturnsAToken(): void
    {
        $hashed = (new CredentialService())->hash('foobar');
        $this->db->prepare('UPDATE sites SET credential_salt = :salt, credential_hash = :hash WHERE id = 1')->execute($hashed);

        $response = $this->controller()->login(new Request('POST', '/api/auth/login', jsonBody: ['credential' => 'foobar']));

        self::assertSame(200, $response->status);
        self::assertArrayHasKey('token', $response->body);
        self::assertNotEmpty($response->body['token']);
    }

    public function testLoginRejectsTheWrongCredential(): void
    {
        $hashed = (new CredentialService())->hash('foobar');
        $this->db->prepare('UPDATE sites SET credential_salt = :salt, credential_hash = :hash WHERE id = 1')->execute($hashed);

        $response = $this->controller()->login(new Request('POST', '/api/auth/login', jsonBody: ['credential' => 'wrong']));

        self::assertSame(401, $response->status);
    }
}
