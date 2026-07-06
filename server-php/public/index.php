<?php

declare(strict_types=1);

use EnklWiki\Auth\AuthMiddleware;
use EnklWiki\Auth\CredentialService;
use EnklWiki\Auth\Jwt;
use EnklWiki\Config;
use EnklWiki\Controllers\AuthController;
use EnklWiki\Controllers\ImportExportController;
use EnklWiki\Controllers\PagesController;
use EnklWiki\Controllers\SiteController;
use EnklWiki\Controllers\TagsController;
use EnklWiki\Controllers\UploadsController;
use EnklWiki\Cors;
use EnklWiki\Db;
use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Router;
use EnklWiki\Services\PageHierarchyService;
use EnklWiki\Services\TagService;

require dirname(__DIR__) . '/vendor/autoload.php';

$config = Config::load();
$request = Request::fromGlobals();

if (Cors::apply($request, $config)) {
    exit; // OPTIONS preflight already fully answered
}

if ($request->path === '/health') {
    try {
        Db::connect($config['db'])->query('SELECT 1');
        send(Response::json(['status' => 'ok']));
    } catch (\Throwable $e) {
        send(Response::serverError('Database unreachable.'));
    }
    exit;
}

if (($config['jwt']['signingKey'] ?? '') === '') {
    send(Response::serverError('Jwt signing key is not configured. Copy config.example.php to config.php and set jwt.signingKey.'));
    exit;
}

$db = Db::connect($config['db']);

// Seed the default "foobar" editor credential and "siteadmin" admin
// credential on first request — mirrors the .NET service's startup check, so
// a freshly migrated database behaves identically to the other two backing
// stores out of the box.
$site = $db->query('SELECT credential_salt, credential_hash, admin_credential_salt, admin_credential_hash FROM sites WHERE id = 1')->fetch();
if ($site !== false) {
    if ($site['credential_salt'] === null || $site['credential_hash'] === null) {
        $seed = (new CredentialService())->hash('foobar');
        $db->prepare('UPDATE sites SET credential_salt = :salt, credential_hash = :hash WHERE id = 1')
            ->execute(['salt' => $seed['salt'], 'hash' => $seed['hash']]);
    }
    if ($site['admin_credential_salt'] === null || $site['admin_credential_hash'] === null) {
        $seed = (new CredentialService())->hash('siteadmin');
        $db->prepare('UPDATE sites SET admin_credential_salt = :salt, admin_credential_hash = :hash WHERE id = 1')
            ->execute(['salt' => $seed['salt'], 'hash' => $seed['hash']]);
    }
}

$credentialService = new CredentialService();
$jwt = new Jwt($config['jwt']['signingKey']);
$auth = new AuthMiddleware($jwt);
$hierarchy = new PageHierarchyService($db);
$tagService = new TagService($db);

$authController = new AuthController($db, $credentialService, $jwt);
$siteController = new SiteController($db, $credentialService);
$tagsController = new TagsController($tagService);
$pagesController = new PagesController($db, $hierarchy, $tagService);
$uploadsController = new UploadsController($db, $config['uploads']['path'], $config['uploads']['allowedExtensions']);
$importExportController = new ImportExportController($db);

$router = new Router();

$router->add('POST', '/api/auth/login', $authController->login(...));

$router->add('GET', '/api/site', $siteController->get(...));
// Site title/description, either credential, and tag pruning are all part
// of Site Settings, so they require the admin credential specifically.
$router->add('PUT', '/api/site', $auth->wrapAdmin($siteController->update(...)));
$router->add('PUT', '/api/site/credential', $auth->wrapAdmin($siteController->changeCredential(...)));

$router->add('DELETE', '/api/tags/unused', $auth->wrapAdmin($tagsController->deleteUnused(...)));

$router->add('GET', '/api/pages', $pagesController->getAll(...));
$router->add('GET', '/api/pages/{id}', $pagesController->getOne(...));
$router->add('GET', '/api/pages/{id}/body', $pagesController->getBody(...));
$router->add('PUT', '/api/pages/{id}/body', $auth->wrap($pagesController->putBody(...)));
$router->add('POST', '/api/pages', $auth->wrap($pagesController->create(...)));
$router->add('PUT', '/api/pages/{id}', $auth->wrap($pagesController->updateMetadata(...)));
$router->add('PUT', '/api/pages/{id}/parent', $auth->wrap($pagesController->reparent(...)));
$router->add('PUT', '/api/pages/{id}/move', $auth->wrap($pagesController->move(...)));
$router->add('PUT', '/api/pages/{id}/archived', $auth->wrap($pagesController->setArchived(...)));
$router->add('DELETE', '/api/pages/{id}', $auth->wrap($pagesController->delete(...)));

$router->add('GET', '/api/uploads', $uploadsController->getAll(...));
$router->add('POST', '/api/uploads', $auth->wrap($uploadsController->upload(...)));
$router->add('GET', '/api/uploads/{fileName}', $uploadsController->download(...));

$router->add('GET', '/api/export', $importExportController->export(...));
// Only ever invoked from Site Settings on the client, so it requires the
// admin credential.
$router->add('POST', '/api/import', $auth->wrapAdmin($importExportController->import(...)));

send($router->dispatch($request));

function send(Response $response): void
{
    http_response_code($response->status);

    if ($response->filePath !== null) {
        header('Content-Type: ' . $response->contentType);
        header('Content-Disposition: inline; filename="' . basename($response->downloadName ?? '') . '"');
        header('Content-Length: ' . (string) filesize($response->filePath));
        readfile($response->filePath);
        return;
    }

    if ($response->status !== 204 && $response->body !== null) {
        header('Content-Type: application/json');
        echo json_encode($response->body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
