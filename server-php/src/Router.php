<?php

declare(strict_types=1);

namespace EnklWiki;

// A tiny method+path router — `{param}` segments become named captures
// passed to the handler's Request. No framework; this is the entire
// routing layer.
final class Router
{
    /** @var array<int, array{method: string, regex: string, paramNames: string[], handler: callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $paramNames = [];
        $regex = preg_replace_callback('#\{(\w+)\}#', function (array $m) use (&$paramNames): string {
            $paramNames[] = $m[1];
            return '([^/]+)';
        }, $pattern);

        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'paramNames' => $paramNames,
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): Response
    {
        $pathMatchedAnyMethod = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $m)) {
                continue;
            }
            $pathMatchedAnyMethod = true;
            if ($route['method'] !== $request->method) {
                continue;
            }

            $params = [];
            foreach ($route['paramNames'] as $i => $name) {
                $params[$name] = urldecode($m[$i + 1]);
            }

            return ($route['handler'])($request->withParams($params));
        }

        return $pathMatchedAnyMethod
            ? Response::json(['error' => 'Method not allowed'], 405)
            : Response::notFound();
    }
}
