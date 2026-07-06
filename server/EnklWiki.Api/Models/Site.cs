namespace EnklWiki.Api.Models;

// Single-tenant: exactly one row, fixed Id = 1.
public class Site
{
    public int Id { get; set; } = 1;
    public string Title { get; set; } = "Enkl-Wiki";
    public string Description { get; set; } = string.Empty;
    public string? CredentialSalt { get; set; }
    public string? CredentialHash { get; set; }

    // Separate admin credential — unlocks everything the editor credential
    // does, plus Site Settings (title/description, either credential, tag
    // pruning, and import). Mirrors src/auth/credential.js's two-tier model.
    public string? AdminCredentialSalt { get; set; }
    public string? AdminCredentialHash { get; set; }
}
