using EnklWiki.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace EnklWiki.Api.Tests;

// Boots the real app in-process against an isolated EF Core InMemory database
// (a fresh, uniquely-named one per factory instance) instead of Postgres, so
// the integration suite needs no external services to run.
public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = $"enklwiki-tests-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SigningKey"] = "test-signing-key-at-least-32-bytes-long!!",
                ["Uploads:Path"] = Path.Combine(Path.GetTempPath(), _dbName, "uploads")
            });
        });

        builder.ConfigureServices(services =>
        {
            // AddDbContext registers the Npgsql configuration as a layered
            // IDbContextOptionsConfiguration<AppDbContext>, not just the
            // DbContextOptions<AppDbContext> singleton itself — removing only
            // the latter leaves UseNpgsql still applied alongside
            // UseInMemoryDatabase and EF refuses to start with two providers.
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<Microsoft.EntityFrameworkCore.Infrastructure.IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_dbName));
        });
    }
}
