<?php

declare(strict_types=1);

namespace EnklWiki;

// Plain value object for a controller's result. The front controller
// (public/index.php) is the only place that actually emits headers/output —
// everything else just builds and returns one of these, which is what makes
// controllers testable by inspecting the return value directly.
final class Response
{
    private function __construct(
        public readonly int $status,
        public readonly mixed $body = null,
        public readonly ?string $filePath = null,
        public readonly ?string $contentType = null,
        public readonly ?string $downloadName = null
    ) {
    }

    public static function json(mixed $body, int $status = 200): self
    {
        return new self($status, $body);
    }

    public static function noContent(): self
    {
        return new self(204);
    }

    public static function notFound(string $message = 'Not found'): self
    {
        return new self(404, ['error' => $message]);
    }

    public static function badRequest(string $message): self
    {
        return new self(400, ['error' => $message]);
    }

    public static function unauthorized(string $message = 'Unauthorized'): self
    {
        return new self(401, ['error' => $message]);
    }

    public static function forbidden(string $message = 'Forbidden'): self
    {
        return new self(403, ['error' => $message]);
    }

    public static function serverError(string $message): self
    {
        return new self(500, ['error' => $message]);
    }

    // A file streamed straight from disk (uploads download) — no JSON body.
    public static function file(string $path, string $contentType, string $downloadName): self
    {
        return new self(200, null, $path, $contentType, $downloadName);
    }
}
