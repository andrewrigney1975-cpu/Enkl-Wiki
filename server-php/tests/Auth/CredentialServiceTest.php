<?php

declare(strict_types=1);

namespace EnklWiki\Tests\Auth;

use EnklWiki\Auth\CredentialService;
use PHPUnit\Framework\TestCase;

final class CredentialServiceTest extends TestCase
{
    public function testHashThenVerifyRoundTripsWithCorrectSecret(): void
    {
        $service = new CredentialService();
        $hashed = $service->hash('foobar');

        self::assertTrue($service->verify('foobar', $hashed['salt'], $hashed['hash']));
    }

    public function testVerifyRejectsWrongSecret(): void
    {
        $service = new CredentialService();
        $hashed = $service->hash('foobar');

        self::assertFalse($service->verify('wrong', $hashed['salt'], $hashed['hash']));
    }

    public function testVerifyReturnsFalseForMissingSaltOrHash(): void
    {
        $service = new CredentialService();
        self::assertFalse($service->verify('foobar', null, 'somehash'));
        self::assertFalse($service->verify('foobar', 'somesalt', null));
    }

    public function testHashProducesADifferentSaltEachTime(): void
    {
        $service = new CredentialService();
        $a = $service->hash('foobar');
        $b = $service->hash('foobar');

        self::assertNotSame($a['salt'], $b['salt']);
    }

    public function testHashAndSaltAreThirtyTwoAndSixteenBytesInHex(): void
    {
        $service = new CredentialService();
        $hashed = $service->hash('foobar');

        self::assertSame(32, strlen($hashed['salt'])); // 16 bytes hex-encoded
        self::assertSame(64, strlen($hashed['hash'])); // 32 bytes hex-encoded
    }
}
