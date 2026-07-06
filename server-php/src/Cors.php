<?php

declare(strict_types=1);

namespace EnklWiki;

// Unlike the Docker Compose deployment of the .NET API (where nginx
// reverse-proxies /api/ same-origin, sidestepping CORS entirely), this
// service is typically reached cross-origin from a separately-hosted static
// client, so correct CORS handling is load-bearing, not optional.
final class Cors
{
    /**
     * @param array<string, mixed> $config
     * @return bool true if the request was an OPTIONS preflight that has
     *              already been fully answered — the caller should stop.
     */
    public static function apply(Request $request, array $config): bool
    {
        $allowed = $config['cors']['allowedOrigins'] ?? [];
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if ($origin !== '' && (in_array('*', $allowed, true) || in_array($origin, $allowed, true))) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
        }

        if ($request->method === 'OPTIONS') {
            http_response_code(204);
            return true;
        }

        return false;
    }
}
