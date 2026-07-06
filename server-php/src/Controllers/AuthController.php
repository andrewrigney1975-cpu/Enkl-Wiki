<?php

declare(strict_types=1);

namespace EnklWiki\Controllers;

use EnklWiki\Auth\CredentialService;
use EnklWiki\Auth\Jwt;
use EnklWiki\Request;
use EnklWiki\Response;
use PDO;

final class AuthController
{
    public function __construct(
        private readonly PDO $db,
        private readonly CredentialService $credentials,
        private readonly Jwt $jwt
    ) {
    }

    // Public: anyone can attempt to unlock editing, same as the client-only
    // modes today. Reads elsewhere never require a token.
    public function login(Request $request): Response
    {
        $stmt = $this->db->query('SELECT credential_salt, credential_hash, admin_credential_salt, admin_credential_hash FROM sites WHERE id = 1');
        $site = $stmt->fetch();

        if (!$site || $site['credential_salt'] === null || $site['credential_hash'] === null) {
            return Response::serverError('Site credential is not configured.');
        }

        $credential = (string) $request->json('credential', '');

        // Admin is checked first so a credential that (unusually) matches
        // both isn't mistaken for the lower tier.
        if ($this->credentials->verify($credential, $site['admin_credential_salt'], $site['admin_credential_hash'])) {
            return Response::json(['token' => $this->jwt->issue('admin'), 'role' => 'admin']);
        }

        if (!$this->credentials->verify($credential, $site['credential_salt'], $site['credential_hash'])) {
            return Response::unauthorized();
        }

        return Response::json(['token' => $this->jwt->issue('editor'), 'role' => 'editor']);
    }
}
