<?php

declare(strict_types=1);

namespace EnklWiki;

use PDO;

final class Db
{
    /** @param array{host: string, port: int, database: string, username: string, password: string} $config */
    public static function connect(array $config): PDO
    {
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $config['host'], $config['port'], $config['database']);
        return new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Native (server-side) prepares can't infer a parameter's type
            // when it's only ever compared with "IS NULL" (e.g. nullable
            // parent_id filters) — emulated prepares substitute values as
            // literals instead, sidestepping that limitation entirely.
            PDO::ATTR_EMULATE_PREPARES => true,
        ]);
    }
}
