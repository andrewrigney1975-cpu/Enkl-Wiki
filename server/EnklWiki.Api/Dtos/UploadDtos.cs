namespace EnklWiki.Api.Dtos;

public record UploadDto(
    string Id,
    string FileName,
    string OriginalFileName,
    string ContentType,
    long Size,
    DateTimeOffset CreatedAt
);
