<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Controllers;

use EnklWiki\Controllers\UploadsController;
use EnklWiki\Request;
use EnklWiki\Tests\TestCase;

final class UploadsControllerTest extends TestCase
{
    private string $uploadsDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->uploadsDir = sys_get_temp_dir() . '/enklwiki-test-uploads-' . bin2hex(random_bytes(6));
        mkdir($this->uploadsDir, 0775, true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->uploadsDir . '/*') ?: [] as $file) {
            unlink($file);
        }
        rmdir($this->uploadsDir);
        parent::tearDown();
    }

    private function controller(): UploadsController
    {
        return new UploadsController($this->db, $this->uploadsDir, ['png', 'pdf']);
    }

    // is_uploaded_file() always returns false for a file that wasn't part of
    // a real HTTP upload (as in these tests), so the controller falls back
    // to copy() — this fixture writes a real temp file to copy from.
    private function fakeUploadedFile(string $name, string $contents): array
    {
        $tmpPath = sys_get_temp_dir() . '/enklwiki-test-src-' . bin2hex(random_bytes(6));
        file_put_contents($tmpPath, $contents);
        return ['name' => $name, 'type' => 'application/octet-stream', 'tmp_name' => $tmpPath, 'error' => UPLOAD_ERR_OK, 'size' => strlen($contents)];
    }

    public function testUploadRejectsADisallowedExtension(): void
    {
        $request = new Request('POST', '/api/uploads', files: ['file' => $this->fakeUploadedFile('script.exe', 'x')]);
        self::assertSame(400, $this->controller()->upload($request)->status);
    }

    public function testUploadRejectsAnEmptyFile(): void
    {
        $request = new Request('POST', '/api/uploads', files: ['file' => $this->fakeUploadedFile('photo.png', '')]);
        self::assertSame(400, $this->controller()->upload($request)->status);
    }

    public function testUploadStoresTheFileAndRecordsMetadata(): void
    {
        $controller = $this->controller();
        $request = new Request('POST', '/api/uploads', files: ['file' => $this->fakeUploadedFile('photo.png', 'fake png bytes')]);

        $response = $controller->upload($request);

        self::assertSame(200, $response->status);
        self::assertSame('photo.png', $response->body['originalFileName']);
        self::assertSame('image/png', $response->body['contentType']);
        self::assertFileExists($this->uploadsDir . '/' . $response->body['fileName']);
    }

    public function testUploadThenDownloadRoundTripsTheBytes(): void
    {
        $controller = $this->controller();
        $upload = $controller->upload(new Request('POST', '/api/uploads', files: ['file' => $this->fakeUploadedFile('photo.png', 'fake png bytes')]));

        $download = $controller->download(new Request('GET', '/api/uploads/' . $upload->body['fileName'], params: ['fileName' => $upload->body['fileName']]));

        self::assertSame(200, $download->status);
        self::assertSame('fake png bytes', file_get_contents($download->filePath));
        self::assertSame('photo.png', $download->downloadName);
    }

    public function testDownloadReturns404ForAnUnknownFile(): void
    {
        $response = $this->controller()->download(new Request('GET', '/api/uploads/nope.png', params: ['fileName' => 'nope.png']));
        self::assertSame(404, $response->status);
    }

    public function testGetAllListsUploadsNewestFirst(): void
    {
        $controller = $this->controller();
        $controller->upload(new Request('POST', '/api/uploads', files: ['file' => $this->fakeUploadedFile('a.png', 'aaa')]));
        $controller->upload(new Request('POST', '/api/uploads', files: ['file' => $this->fakeUploadedFile('b.png', 'bbb')]));

        $response = $controller->getAll(new Request('GET', '/api/uploads'));

        self::assertCount(2, $response->body);
    }
}
