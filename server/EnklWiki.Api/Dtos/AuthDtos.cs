namespace EnklWiki.Api.Dtos;

public record LoginRequestDto(string Credential);

public record LoginResponseDto(string Token);

public record ChangeCredentialDto(string NewCredential);
