<?php

declare(strict_types=1);

namespace EnklWiki\Auth;

use EnklWiki\Request;
use EnklWiki\Response;

final class AuthMiddleware
{
    public function __construct(private readonly Jwt $jwt)
    {
    }

    // Returns null to let the request proceed, or a 401 Response to short-circuit it.
    public function requireEditor(Request $request): ?Response
    {
        return $this->jwt->verify($request->bearerToken) ? null : Response::unauthorized();
    }

    // Wraps a route handler so index.php's route table can mark it "editor"
    // without every controller method re-checking auth itself.
    public function wrap(callable $handler): callable
    {
        return function (Request $request) use ($handler): Response {
            return $this->requireEditor($request) ?? $handler($request);
        };
    }
}
