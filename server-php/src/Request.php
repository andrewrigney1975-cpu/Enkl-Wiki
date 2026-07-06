<?php

declare(strict_types=1);

namespace EnklWiki;

// Wraps everything a controller needs from an incoming HTTP request into a
// plain value object, rather than reading superglobals directly — this is
// what lets controllers be unit-tested by constructing a Request by hand,
// with no real HTTP server involved.
final class Request
{
    /**
     * @param array<string, string> $query
     * @param array<string, string> $params
     * @param array<string, mixed> $jsonBody
     * @param array<string, mixed> $files
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query = [],
        public readonly array $params = [],
        private readonly array $jsonBody = [],
        public readonly ?string $bearerToken = null,
        public readonly array $files = []
    ) {
    }

    public function json(string $key, mixed $default = null): mixed
    {
        return $this->jsonBody[$key] ?? $default;
    }

    /** @return array<string, mixed> */
    public function jsonBody(): array
    {
        return $this->jsonBody;
    }

    public function param(string $name): ?string
    {
        return $this->params[$name] ?? null;
    }

    /** @param array<string, string> $params */
    public function withParams(array $params): self
    {
        return new self($this->method, $this->path, $this->query, $params, $this->jsonBody, $this->bearerToken, $this->files);
    }

    public static function fromGlobals(): self
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        $jsonBody = [];
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input') ?: '';
            if ($raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $jsonBody = $decoded;
                }
            }
        }

        $authHeader = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] // some Apache/CGI setups strip the header unless aliased like this
            ?? '';
        $bearerToken = null;
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
            $bearerToken = trim($m[1]);
        }

        return new self($method, $path, $_GET, [], $jsonBody, $bearerToken, $_FILES);
    }
}
