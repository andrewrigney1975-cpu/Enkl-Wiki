namespace EnklWiki.Api.Models;

public class Upload
{
    public string Id { get; set; } = string.Empty;
    // The name the file is stored under on disk and served back at
    // GET /api/uploads/{fileName} — collision-resolved, url-safe.
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
