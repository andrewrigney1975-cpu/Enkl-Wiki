namespace EnklWiki.Api.Models;

public class Page
{
    public string Id { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? ParentId { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool Archived { get; set; }
    public int SortOrder { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<Tag> Tags { get; set; } = new();
}
