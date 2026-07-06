<?php

declare(strict_types=1);

namespace EnklWiki\Auth;

use Firebase\JWT\BeforeValidException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use UnexpectedValueException;

// Thin wrapper over firebase/php-jwt — HS256 sign/verify is exactly the kind
// of thing (constant-time checks, algorithm pinning against "alg: none"
// attacks) not worth hand-rolling. Not required to be wire-compatible with
// the .NET service's tokens; each backend issues and verifies its own.
final class Jwt
{
    private const ISSUER = 'enkl-wiki-api-php';
    private const AUDIENCE = 'enkl-wiki-client';
    private const TTL_SECONDS = 12 * 3600;

    public function __construct(private readonly string $signingKey)
    {
    }

    public function issue(): string
    {
        $now = time();
        return FirebaseJwt::encode([
            'iss' => self::ISSUER,
            'aud' => self::AUDIENCE,
            'role' => 'editor',
            'iat' => $now,
            'exp' => $now + self::TTL_SECONDS,
        ], $this->signingKey, 'HS256');
    }

    public function verify(?string $token): bool
    {
        if (!$token) {
            return false;
        }

        try {
            $decoded = FirebaseJwt::decode($token, new Key($this->signingKey, 'HS256'));
        } catch (ExpiredException|BeforeValidException|SignatureInvalidException|UnexpectedValueException) {
            // Anything else (e.g. an empty signing key) is a deployment
            // misconfiguration, not an invalid token — let it propagate.
            return false;
        }

        return ($decoded->iss ?? null) === self::ISSUER
            && ($decoded->aud ?? null) === self::AUDIENCE
            && ($decoded->role ?? null) === 'editor';
    }
}
