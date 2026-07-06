namespace EnklWiki.Api.Dtos;

public record PageExportDto(
    string Id,
    string Slug,
    string? ParentId,
    string Title,
    List<string> TagIds,
    bool Archived,
    string Body,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

// GET /api/export — full-fidelity backup, every page's body inlined.
public record ExportSiteDto(
    ExportSiteInfoDto Site,
    List<TagDto> Tags,
    List<PageExportDto> Pages,
    List<UploadDto> Uploads
);

public record ExportSiteInfoDto(string Title, string Description);

// POST /api/import — accepts the same shape the client's own exportConfig()
// produces (site/tags/pages/uploads; a "settings" object may also be present
// and is ignored — the server keeps its own credential). Uploads are
// metadata-only in this payload (no binary content travels in JSON), so
// import restores everything except the actual uploaded files; those need
// re-uploading afterwards.
public record ImportPageDto(
    string Id,
    string Slug,
    string? ParentId,
    string Title,
    List<string>? TagIds,
    bool Archived,
    string? Body,
    DateTimeOffset? CreatedAt,
    DateTimeOffset? UpdatedAt
);

public record ImportSiteDto(
    ImportSiteInfoDto Site,
    List<TagDto>? Tags,
    List<ImportPageDto> Pages
);

public record ImportSiteInfoDto(string Title, string? Description);
