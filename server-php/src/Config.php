<?php

declare(strict_types=1);

namespace EnklWiki;

// Loads config.php (gitignored, copied from config.example.php) merged over
// environment-variable defaults, so the same code works whether an operator
// prefers editing a checked-out file (typical shared hosting) or setting
// real env vars (typical VPS/systemd setup).
final class Config
{
    /** @var array<string, mixed>|null */
    private static ?array $data = null;

    /** @return array<string, mixed> */
    public static function load(?string $configFile = null): array
    {
        if (self::$data !== null) {
            return self::$data;
        }

        $configFile ??= dirname(__DIR__) . '/config.php';
        $fromFile = is_file($configFile) ? (require $configFile) : [];
        if (!is_array($fromFile)) {
            $fromFile = [];
        }

        self::$data = array_replace_recursive(self::defaults(), $fromFile);
        return self::$data;
    }

    // Exposed for tests, which build their own config instead of reading a file.
    public static function reset(): void
    {
        self::$data = null;
    }

    /** @return array<string, mixed> */
    private static function defaults(): array
    {
        $corsOrigins = getenv('CORS_ALLOWED_ORIGINS');

        return [
            'db' => [
                'host' => getenv('DB_HOST') ?: 'localhost',
                'port' => (int) (getenv('DB_PORT') ?: 5432),
                'database' => getenv('DB_NAME') ?: 'enklwiki',
                'username' => getenv('DB_USER') ?: 'enklwiki',
                'password' => getenv('DB_PASSWORD') ?: '',
            ],
            'jwt' => [
                'signingKey' => getenv('JWT_SIGNING_KEY') ?: '',
            ],
            'cors' => [
                // Empty means "no cross-origin access" — an operator must
                // opt in explicitly, same spirit as the .NET service falling
                // back to permissive only when nothing is configured, except
                // here we default to the safer "deny" since this is meant to
                // be reachable directly from the public internet.
                'allowedOrigins' => $corsOrigins ? array_filter(array_map('trim', explode(',', $corsOrigins))) : [],
            ],
            'uploads' => [
                'path' => getenv('UPLOADS_PATH') ?: (dirname(__DIR__) . '/storage/uploads'),
                'allowedExtensions' => ['svg', 'png', 'jpg', 'jpeg', 'mp3', 'mp4', 'pdf'],
            ],
        ];
    }
}
