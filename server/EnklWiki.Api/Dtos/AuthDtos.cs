namespace EnklWiki.Api.Dtos;

public record LoginRequestDto(string Credential);

public record LoginResponseDto(string Token, string Role);

// Role selects which of the two credentials to replace ("editor" or
// "admin") — the caller must already hold an admin token to call this at
// all, but an admin can change either credential.
public record ChangeCredentialDto(string NewCredential, string Role = "editor");
