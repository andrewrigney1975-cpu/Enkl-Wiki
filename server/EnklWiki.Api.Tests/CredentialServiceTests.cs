using EnklWiki.Api.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EnklWiki.Api.Tests;

public class CredentialServiceTests
{
    private static CredentialService CreateService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:SigningKey"] = "test-signing-key-at-least-32-bytes-long!!" })
            .Build();
        return new CredentialService(config);
    }

    [Fact]
    public void HashCredential_then_VerifyCredential_round_trips_with_the_correct_secret()
    {
        var service = CreateService();
        var (salt, hash) = service.HashCredential("foobar");

        Assert.True(service.VerifyCredential("foobar", salt, hash));
    }

    [Fact]
    public void VerifyCredential_rejects_the_wrong_secret()
    {
        var service = CreateService();
        var (salt, hash) = service.HashCredential("foobar");

        Assert.False(service.VerifyCredential("wrong", salt, hash));
    }

    [Fact]
    public void VerifyCredential_returns_false_for_missing_salt_or_hash()
    {
        var service = CreateService();
        Assert.False(service.VerifyCredential("foobar", "", "somehash"));
        Assert.False(service.VerifyCredential("foobar", "somesalt", ""));
    }

    [Fact]
    public void HashCredential_produces_a_different_salt_each_time()
    {
        var service = CreateService();
        var (salt1, _) = service.HashCredential("foobar");
        var (salt2, _) = service.HashCredential("foobar");

        Assert.NotEqual(salt1, salt2);
    }

    [Fact]
    public void IssueToken_produces_a_non_empty_JWT_with_three_segments()
    {
        var service = CreateService();
        var token = service.IssueToken("editor");

        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.Equal(3, token.Split('.').Length);
    }
}
