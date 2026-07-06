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
    // Any valid role (editor or admin) passes — admin is a superset of editor.
    public function requireEditor(Request $request): ?Response
    {
        return $this->jwt->verify($request->bearerToken) !== null ? null : Response::unauthorized();
    }

    // Returns null to let the request proceed, a 401 if there's no valid
    // token at all, or a 403 if the token is valid but not for the admin
    // tier — matching ASP.NET Core's [Authorize(Roles = "admin")] behavior.
    public function requireAdmin(Request $request): ?Response
    {
        $role = $this->jwt->verify($request->bearerToken);
        if ($role === null) {
            return Response::unauthorized();
        }
        return $role === 'admin' ? null : Response::forbidden();
    }

    // Wraps a route handler so index.php's route table can mark it "editor"
    // without every controller method re-checking auth itself.
    public function wrap(callable $handler): callable
    {
        return function (Request $request) use ($handler): Response {
            return $this->requireEditor($request) ?? $handler($request);
        };
    }

    // Same, for routes that are part of Site Settings and require the admin
    // credential specifically (site title/description, either credential,
    // tag pruning, import).
    public function wrapAdmin(callable $handler): callable
    {
        return function (Request $request) use ($handler): Response {
            return $this->requireAdmin($request) ?? $handler($request);
        };
    }
}
