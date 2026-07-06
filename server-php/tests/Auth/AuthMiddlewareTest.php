<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Auth;

use EnklWiki\Auth\AuthMiddleware;
use EnklWiki\Auth\Jwt;
use EnklWiki\Request;
use EnklWiki\Response;
use PHPUnit\Framework\TestCase;

final class AuthMiddlewareTest extends TestCase
{
    private const KEY = 'test-signing-key-at-least-32-bytes-long!!';

    private function middleware(): AuthMiddleware
    {
        return new AuthMiddleware(new Jwt(self::KEY));
    }

    private function requestWithToken(?string $token): Request
    {
        return new Request('GET', '/', bearerToken: $token);
    }

    public function testRequireEditorAcceptsEitherRole(): void
    {
        $jwt = new Jwt(self::KEY);
        $middleware = $this->middleware();

        self::assertNull($middleware->requireEditor($this->requestWithToken($jwt->issue('editor'))));
        self::assertNull($middleware->requireEditor($this->requestWithToken($jwt->issue('admin'))));
    }

    public function testRequireEditorRejectsAMissingOrInvalidToken(): void
    {
        $middleware = $this->middleware();

        self::assertSame(401, $middleware->requireEditor($this->requestWithToken(null))?->status);
        self::assertSame(401, $middleware->requireEditor($this->requestWithToken('garbage'))?->status);
    }

    public function testRequireAdminAcceptsOnlyTheAdminRole(): void
    {
        $jwt = new Jwt(self::KEY);
        $middleware = $this->middleware();

        self::assertNull($middleware->requireAdmin($this->requestWithToken($jwt->issue('admin'))));

        $editorResult = $middleware->requireAdmin($this->requestWithToken($jwt->issue('editor')));
        self::assertInstanceOf(Response::class, $editorResult);
        self::assertSame(403, $editorResult->status);
    }

    public function testRequireAdminRejectsAMissingTokenWithUnauthorizedNotForbidden(): void
    {
        $result = $this->middleware()->requireAdmin($this->requestWithToken(null));
        self::assertInstanceOf(Response::class, $result);
        self::assertSame(401, $result->status);
    }

    public function testWrapAdminInvokesTheHandlerOnlyForAdmins(): void
    {
        $jwt = new Jwt(self::KEY);
        $middleware = $this->middleware();
        $handler = $middleware->wrapAdmin(fn (Request $r) => Response::json(['ok' => true]));

        $adminResponse = $handler($this->requestWithToken($jwt->issue('admin')));
        self::assertSame(200, $adminResponse->status);

        $editorResponse = $handler($this->requestWithToken($jwt->issue('editor')));
        self::assertSame(403, $editorResponse->status);
    }
}
