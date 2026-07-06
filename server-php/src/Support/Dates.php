<?php

declare(strict_types=1);

namespace EnklWiki\Support;

use DateTimeImmutable;
use DateTimeZone;

final class Dates
{
    private static ?DateTimeZone $utc = null;

    private static function utc(): DateTimeZone
    {
        return self::$utc ??= new DateTimeZone('UTC');
    }

    // Postgres returns timestamptz values in its own default text format
    // (e.g. "2026-07-07 03:30:00+00"); normalize whatever comes back to
    // strict ISO 8601 in UTC, which is what the JS client expects to feed
    // straight into `new Date(...)`.
    public static function toIso(string $timestamp): string
    {
        $dt = (new DateTimeImmutable($timestamp))->setTimezone(self::utc());
        return $dt->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function nowIso(): string
    {
        return (new DateTimeImmutable('now', self::utc()))->format('Y-m-d\TH:i:s.v\Z');
    }
}
