namespace EnklWiki.Api.Models;

public class Tag
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public List<Page> Pages { get; set; } = new();
}
