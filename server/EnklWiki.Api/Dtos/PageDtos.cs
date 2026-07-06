namespace EnklWiki.Api.Dtos;

public record PageSummaryDto(
    string Id,
    string Slug,
    string? ParentId,
    string Title,
    List<string> TagIds,
    bool Archived,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record PageBodyDto(string Body);

public record CreatePageDto(string Title, string? ParentId, List<string>? TagNames);

public record UpdatePageMetadataDto(string Title, List<string>? TagNames);

public record ReparentPageDto(string? NewParentId);

public record MovePageDto(string Direction); // "up" | "down"

public record SetArchivedDto(bool Archived);

public record DeletePageResolutionDto(string Type, string? NewParentId); // "cascade" | "repoint" | "promote"
