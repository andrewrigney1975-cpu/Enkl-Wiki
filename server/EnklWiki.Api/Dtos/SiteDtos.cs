namespace EnklWiki.Api.Dtos;

public record TagDto(string Id, string Name);

// GET /api/site — everything the client needs to boot, pages as metadata only
// (bodies are fetched lazily per page, mirroring FilesystemProvider).
public record SiteResponseDto(
    string Title,
    string Description,
    List<TagDto> Tags,
    List<PageSummaryDto> Pages,
    List<UploadDto> Uploads
);

public record SiteUpdateDto(string Title, string Description);
