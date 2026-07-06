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
        self::assertSame('editor', $response->body['role']);
    }

    public function testLoginRejectsTheWrongCredential(): void
    {
        $hashed = (new CredentialService())->hash('foobar');
        $this->db->prepare('UPDATE sites SET credential_salt = :salt, credential_hash = :hash WHERE id = 1')->execute($hashed);

        $response = $this->controller()->login(new Request('POST', '/api/auth/login', jsonBody: ['credential' => 'wrong']));

        self::assertSame(401, $response->status);
    }

    public function testLoginWithTheAdminCredentialReturnsTheAdminRole(): void
    {
        $credentials = new CredentialService();
        $editor = $credentials->hash('foobar');
        $admin = $credentials->hash('siteadmin');
        $this->db->prepare(
            'UPDATE sites SET credential_salt = :editorSalt, credential_hash = :editorHash, '
            . 'admin_credential_salt = :adminSalt, admin_credential_hash = :adminHash WHERE id = 1'
        )->execute([
            'editorSalt' => $editor['salt'], 'editorHash' => $editor['hash'],
            'adminSalt' => $admin['salt'], 'adminHash' => $admin['hash'],
        ]);

        $response = $this->controller()->login(new Request('POST', '/api/auth/login', jsonBody: ['credential' => 'siteadmin']));

        self::assertSame(200, $response->status);
        self::assertSame('admin', $response->body['role']);
    }

    public function testLoginWithTheEditorCredentialReturnsTheEditorRoleEvenWhenAnAdminCredentialIsConfigured(): void
    {
        $credentials = new CredentialService();
        $editor = $credentials->hash('foobar');
        $admin = $credentials->hash('siteadmin');
        $this->db->prepare(
            'UPDATE sites SET credential_salt = :editorSalt, credential_hash = :editorHash, '
            . 'admin_credential_salt = :adminSalt, admin_credential_hash = :adminHash WHERE id = 1'
        )->execute([
            'editorSalt' => $editor['salt'], 'editorHash' => $editor['hash'],
            'adminSalt' => $admin['salt'], 'adminHash' => $admin['hash'],
        ]);

        $response = $this->controller()->login(new Request('POST', '/api/auth/login', jsonBody: ['credential' => 'foobar']));

        self::assertSame(200, $response->status);
        self::assertSame('editor', $response->body['role']);
    }
}
