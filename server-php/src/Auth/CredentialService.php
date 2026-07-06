<?php

declare(strict_types=1);

namespace EnklWiki\Auth;

// Mirrors the client's SubtleCrypto PBKDF2 credential hashing exactly
// (src/auth/credential.js) and the .NET service's CredentialService.cs, so
// all three independently arrive at the same scheme: PBKDF2-SHA256,
// 100,000 iterations, 16-byte salt, 256-bit derived key, lowercase hex.
final class CredentialService
{
    private const ITERATIONS = 100_000;
    private const SALT_BYTES = 16;
    private const HASH_BYTES = 32;

    /** @return array{salt: string, hash: string} */
    public function hash(string $secret): array
    {
        $salt = random_bytes(self::SALT_BYTES);
        return [
            'salt' => bin2hex($salt),
            'hash' => bin2hex($this->derive($secret, $salt)),
        ];
    }

    public function verify(string $secret, ?string $saltHex, ?string $hashHex): bool
    {
        if (!$saltHex || !$hashHex) {
            return false;
        }

        $salt = @hex2bin($saltHex);
        $expected = @hex2bin($hashHex);
        if ($salt === false || $expected === false) {
            return false;
        }

        return hash_equals($expected, $this->derive($secret, $salt));
    }

    private function derive(string $secret, string $salt): string
    {
        return hash_pbkdf2('sha256', $secret, $salt, self::ITERATIONS, self::HASH_BYTES, true);
    }
}
