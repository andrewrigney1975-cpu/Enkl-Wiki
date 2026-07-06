using System.Text;
using EnklWiki.Api.Data;
using EnklWiki.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddScoped<PageHierarchyService>();
builder.Services.AddScoped<TagService>();
builder.Services.AddScoped<CredentialService>();

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Client", policy =>
    {
        if (corsOrigins.Length > 0)
        {
            policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            // No allow-list configured (e.g. local dev without a fixed client
            // origin) — fall back to permissive so the feature is usable
            // out of the box; production deployments should set Cors:AllowedOrigins.
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Read lazily (inside the callback) rather than capturing a local
        // variable computed before builder.Build() — this options callback
        // only actually runs on first use, by which point WebApplicationFactory
        // test overrides of configuration have been layered in; a captured
        // outer variable would still hold the pre-override value.
        var jwtSigningKey = builder.Configuration["Jwt:SigningKey"]
            ?? throw new InvalidOperationException("Jwt:SigningKey is not configured.");

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "enkl-wiki-api",
            ValidateAudience = true,
            ValidAudience = "enkl-wiki-client",
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey))
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddHealthChecks();

var app = builder.Build();

// Apply pending migrations on startup — simplest option for a self-hosted /
// docker-compose deployment with no separate migration step. Also seeds the
// default "foobar" editor credential and "siteadmin" admin credential on
// first run, matching the client-only modes' defaults (src/auth/credential.js).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // The InMemory provider used by the xUnit WebApplicationFactory tests
    // doesn't support migrations — EnsureCreated() is its equivalent.
    if (db.Database.IsRelational()) db.Database.Migrate();
    else db.Database.EnsureCreated();

    var site = await db.Sites.FindAsync(1);
    if (site is not null)
    {
        var credentialService = scope.ServiceProvider.GetRequiredService<CredentialService>();
        var changed = false;

        if (site.CredentialSalt is null || site.CredentialHash is null)
        {
            var (salt, hash) = credentialService.HashCredential("foobar");
            site.CredentialSalt = salt;
            site.CredentialHash = hash;
            changed = true;
        }
        if (site.AdminCredentialSalt is null || site.AdminCredentialHash is null)
        {
            var (salt, hash) = credentialService.HashCredential("siteadmin");
            site.AdminCredentialSalt = salt;
            site.AdminCredentialHash = hash;
            changed = true;
        }

        if (changed) await db.SaveChangesAsync();
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Client");
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

// Exposed so WebApplicationFactory<Program> can boot this app in-process for
// integration tests.
public partial class Program { }
