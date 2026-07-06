namespace EnklWiki.Api.Models;

// Single-tenant: exactly one row, fixed Id = 1.
public class Site
{
    public int Id { get; set; } = 1;
    public string Title { get; set; } = "Enkl-Wiki";
    public string Description { get; set; } = string.Empty;
    public string? CredentialSalt { get; set; }
    public string? CredentialHash { get; set; }
}
