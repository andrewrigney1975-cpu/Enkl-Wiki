<?php

declare(strict_types=1);

namespace EnklWiki\Controllers;

use EnklWiki\Auth\CredentialService;
use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Support\PageRepository;
use EnklWiki\Support\UploadRepository;
use PDO;

final class SiteController
{
    public function __construct(
        private readonly PDO $db,
        private readonly CredentialService $credentials
    ) {
    }

    // Public read — visitors can always browse, matching the existing
    // visitor/editor distinction from the client-only modes.
    public function get(Request $request): Response
    {
        $site = $this->db->query('SELECT title, description FROM sites WHERE id = 1')->fetch();
        if ($site === false) {
            return Response::notFound();
        }

        $tags = $this->db->query('SELECT id, name FROM tags')->fetchAll();
        $uploads = $this->db->query('SELECT * FROM uploads ORDER BY created_at')->fetchAll();

        return Response::json([
            'title' => $site['title'],
            'description' => $site['description'],
            'tags' => $tags,
            'pages' => PageRepository::allSummaries($this->db),
            'uploads' => array_map(UploadRepository::toDto(...), $uploads),
        ]);
    }

    public function update(Request $request): Response
    {
        $title = (string) $request->json('title', '');
        $description = (string) $request->json('description', '');

        $stmt = $this->db->prepare('UPDATE sites SET title = :title, description = :description WHERE id = 1');
        $stmt->execute(['title' => $title, 'description' => $description]);

        return Response::noContent();
    }

    // Gated by the JWT obtained at login (POST /api/auth/login) — that
    // already proves knowledge of the current credential, so it isn't asked
    // for again here, matching the client-only modes' simplicity.
    public function changeCredential(Request $request): Response
    {
        $newCredential = (string) $request->json('newCredential', '');
        if ($newCredential === '') {
            return Response::badRequest('newCredential is required.');
        }

        $hashed = $this->credentials->hash($newCredential);
        $stmt = $this->db->prepare('UPDATE sites SET credential_salt = :salt, credential_hash = :hash WHERE id = 1');
        $stmt->execute(['salt' => $hashed['salt'], 'hash' => $hashed['hash']]);

        return Response::noContent();
    }
}
