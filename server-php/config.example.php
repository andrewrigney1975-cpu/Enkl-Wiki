<?php

// Copy this file to config.php (gitignored) and fill in real values, or set
// the equivalent environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER,
// DB_PASSWORD, JWT_SIGNING_KEY, CORS_ALLOWED_ORIGINS, UPLOADS_PATH) instead —
// see src/Config.php. Values here override the environment-variable defaults.

return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 5432,
        'database' => 'enklwiki',
        'username' => 'enklwiki',
        'password' => 'change-me',
    ],

    // Any long random string — generate one with, e.g., `openssl rand -base64 32`.
    'jwt' => [
        'signingKey' => 'change-me-to-a-long-random-string',
    ],

    // The origin(s) your static Enkl-Wiki client is served from. Required —
    // with none configured, all cross-origin requests are rejected.
    'cors' => [
        'allowedOrigins' => [
            'https://your-wiki.example.com',
        ],
    ],

    'uploads' => [
        // Kept outside public/ so uploaded files are only ever reachable
        // through GET /api/uploads/{fileName} (which checks the DB first),
        // never by guessing a URL directly.
        'path' => __DIR__ . '/storage/uploads',
    ],
];
