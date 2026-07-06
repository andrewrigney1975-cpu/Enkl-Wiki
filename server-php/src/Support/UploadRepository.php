<?php

declare(strict_types=1);

namespace EnklWiki\Support;

final class UploadRepository
{
    /** @param array<string, mixed> $row @return array<string, mixed> */
    public static function toDto(array $row): array
    {
        return [
            'id' => $row['id'],
            'fileName' => $row['file_name'],
            'originalFileName' => $row['original_file_name'],
            'contentType' => $row['content_type'],
            'size' => (int) $row['size'],
            'createdAt' => Dates::toIso($row['created_at']),
        ];
    }
}
