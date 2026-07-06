<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Auth;

use EnklWiki\Auth\Jwt;
use PHPUnit\Framework\TestCase;

final class JwtTest extends TestCase
{
    public function testIssuedTokenVerifiesSuccessfullyAndCarriesItsRole(): void
    {
        $jwt = new Jwt('test-signing-key-at-least-32-bytes-long!!');

        self::assertSame('editor', $jwt->verify($jwt->issue('editor')));
        self::assertSame('admin', $jwt->verify($jwt->issue('admin')));
    }

    public function testVerifyRejectsGarbageOrNullTokens(): void
    {
        $jwt = new Jwt('test-signing-key-at-least-32-bytes-long!!');

        self::assertNull($jwt->verify('garbage'));
        self::assertNull($jwt->verify(null));
        self::assertNull($jwt->verify(''));
    }

    public function testVerifyRejectsATokenSignedWithADifferentKey(): void
    {
        $issuer = new Jwt('key-one-at-least-32-bytes-long-for-hs256');
        $verifier = new Jwt('key-two-at-least-32-bytes-long-for-hs256');

        self::assertNull($verifier->verify($issuer->issue('editor')));
    }

    public function testVerifyRejectsAnExpiredToken(): void
    {
        // Build an already-expired token directly, bypassing issue()'s fixed TTL.
        $key = 'test-signing-key-at-least-32-bytes-long!!';
        $expired = \Firebase\JWT\JWT::encode([
            'iss' => 'enkl-wiki-api-php', 'aud' => 'enkl-wiki-client', 'role' => 'editor',
            'iat' => time() - 100, 'exp' => time() - 50,
        ], $key, 'HS256');

        self::assertNull((new Jwt($key))->verify($expired));
    }
}
