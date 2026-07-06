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

    public function issue(string $role): string
    {
        $now = time();
        return FirebaseJwt::encode([
            'iss' => self::ISSUER,
            'aud' => self::AUDIENCE,
            'role' => $role,
            'iat' => $now,
            'exp' => $now + self::TTL_SECONDS,
        ], $this->signingKey, 'HS256');
    }

    // Returns the token's role claim ('editor' | 'admin') if the token is
    // valid, or null otherwise — null lets a caller distinguish "no valid
    // token" (401) from "valid token, wrong role" (403).
    public function verify(?string $token): ?string
    {
        if (!$token) {
            return null;
        }

        try {
            $decoded = FirebaseJwt::decode($token, new Key($this->signingKey, 'HS256'));
        } catch (ExpiredException|BeforeValidException|SignatureInvalidException|UnexpectedValueException) {
            // Anything else (e.g. an empty signing key) is a deployment
            // misconfiguration, not an invalid token — let it propagate.
            return null;
        }

        if (($decoded->iss ?? null) !== self::ISSUER || ($decoded->aud ?? null) !== self::AUDIENCE) {
            return null;
        }

        $role = $decoded->role ?? null;
        return is_string($role) ? $role : null;
    }
}
