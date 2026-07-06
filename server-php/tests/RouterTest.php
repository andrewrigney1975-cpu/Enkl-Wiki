<?php

declare(strict_types=1);

namespace EnklWiki\Tests;

use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Router;
use PHPUnit\Framework\TestCase;

final class RouterTest extends TestCase
{
    public function testDispatchesToTheMatchingHandlerAndExtractsPathParams(): void
    {
        $router = new Router();
        $router->add('GET', '/api/pages/{id}/body', fn (Request $r) => Response::json(['id' => $r->param('id')]));

        $response = $router->dispatch(new Request('GET', '/api/pages/abc123/body'));

        self::assertSame(200, $response->status);
        self::assertSame(['id' => 'abc123'], $response->body);
    }

    public function testReturns404ForAnUnmatchedPath(): void
    {
        $router = new Router();
        $router->add('GET', '/api/site', fn (Request $r) => Response::noContent());

        self::assertSame(404, $router->dispatch(new Request('GET', '/nope'))->status);
    }

    public function testReturns405WhenThePathMatchesButNotTheMethod(): void
    {
        $router = new Router();
        $router->add('GET', '/api/site', fn (Request $r) => Response::noContent());

        self::assertSame(405, $router->dispatch(new Request('DELETE', '/api/site'))->status);
    }

    public function testDoesNotConfuseAStaticRouteWithAParameterizedOneAtTheSamePrefix(): void
    {
        $router = new Router();
        $router->add('GET', '/api/uploads', fn (Request $r) => Response::json(['route' => 'all']));
        $router->add('GET', '/api/uploads/{fileName}', fn (Request $r) => Response::json(['route' => 'one', 'fileName' => $r->param('fileName')]));

        self::assertSame(['route' => 'all'], $router->dispatch(new Request('GET', '/api/uploads'))->body);
        self::assertSame(
            ['route' => 'one', 'fileName' => 'photo.png'],
            $router->dispatch(new Request('GET', '/api/uploads/photo.png'))->body
        );
    }
}
