<?php

declare(strict_types=1);

namespace EnklWiki\Controllers;

use EnklWiki\Request;
use EnklWiki\Response;
use EnklWiki\Support\Dates;
use EnklWiki\Support\UploadRepository;
use PDO;

final class UploadsController
{
    private const CONTENT_TYPES = [
        'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'mp3' => 'audio/mpeg', 'mp4' => 'video/mp4', 'pdf' => 'application/pdf',
    ];

    /** @param string[] $allowedExtensions */
    public function __construct(
        private readonly PDO $db,
        private readonly string $uploadsPath,
        private readonly array $allowedExtensions
    ) {
    }

    public function getAll(Request $request): Response
    {
        $rows = $this->db->query('SELECT * FROM uploads ORDER BY created_at DESC')->fetchAll();
        return Response::json(array_map(UploadRepository::toDto(...), $rows));
    }

    public function upload(Request $request): Response
    {
        $file = $request->files['file'] ?? null;
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return Response::badRequest('No file was uploaded.');
        }
        if ((int) $file['size'] === 0) {
            return Response::badRequest('File is empty.');
        }

        $originalName = (string) $file['name'];
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, $this->allowedExtensions, true)) {
            return Response::badRequest(
                sprintf('".%s" files aren\'t supported here. Allowed: %s.', $ext, implode(', ', $this->allowedExtensions))
            );
        }

        if (!is_dir($this->uploadsPath)) {
            mkdir($this->uploadsPath, 0775, true);
        }

        $storedName = bin2hex(random_bytes(16)) . '.' . $ext;
        $destination = rtrim($this->uploadsPath, '/\\') . DIRECTORY_SEPARATOR . $storedName;

        $tmpName = (string) $file['tmp_name'];
        $moved = is_uploaded_file($tmpName) ? move_uploaded_file($tmpName, $destination) : copy($tmpName, $destination);
        if (!$moved) {
            return Response::serverError('Could not store the uploaded file.');
        }

        $contentType = self::CONTENT_TYPES[$ext] ?? 'application/octet-stream';
        $id = bin2hex(random_bytes(16));
        $now = Dates::nowIso();

        $stmt = $this->db->prepare(
            'INSERT INTO uploads (id, file_name, original_file_name, content_type, size, created_at)
             VALUES (:id, :fileName, :originalFileName, :contentType, :size, :createdAt)'
        );
        $stmt->execute([
            'id' => $id, 'fileName' => $storedName, 'originalFileName' => $originalName,
            'contentType' => $contentType, 'size' => (int) $file['size'], 'createdAt' => $now,
        ]);

        return Response::json([
            'id' => $id, 'fileName' => $storedName, 'originalFileName' => $originalName,
            'contentType' => $contentType, 'size' => (int) $file['size'], 'createdAt' => $now,
        ]);
    }

    public function download(Request $request): Response
    {
        $fileName = (string) $request->param('fileName');
        $stmt = $this->db->prepare('SELECT * FROM uploads WHERE file_name = :fileName');
        $stmt->execute(['fileName' => $fileName]);
        $upload = $stmt->fetch();
        if ($upload === false) {
            return Response::notFound();
        }

        // Defends against a file_name that (however it got there) contains
        // path-traversal segments — stored names are always our own
        // hex-plus-extension, but this keeps the guarantee explicit.
        $safeName = basename($upload['file_name']);
        $path = rtrim($this->uploadsPath, '/\\') . DIRECTORY_SEPARATOR . $safeName;
        if (!is_file($path)) {
            return Response::notFound();
        }

        return Response::file($path, $upload['content_type'], $upload['original_file_name']);
    }
}
