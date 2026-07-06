using System.Text.RegularExpressions;
using EnklWiki.Api.Data;
using EnklWiki.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Services;

public partial class TagService(AppDbContext db)
{
    [GeneratedRegex(@"^#|\s+")]
    private static partial Regex NormalizePattern();

    public static string NormalizeTagName(string raw) =>
        NormalizePattern().Replace(raw.Trim(), m => m.Value.StartsWith('#') ? string.Empty : "-").ToLowerInvariant();

    // Resolves a list of raw tag names (as typed by an editor) to Tag rows,
    // creating any that don't already exist by name — mirrors the client's
    // findOrCreateTag (src/content/tag-model.js).
    public async Task<List<Tag>> ResolveTagsAsync(IEnumerable<string> rawNames)
    {
        var normalized = rawNames
            .Select(NormalizeTagName)
            .Where(n => !string.IsNullOrEmpty(n))
            .Distinct()
            .ToList();

        var existing = await db.Tags.Where(t => normalized.Contains(t.Name)).ToListAsync();
        var result = new List<Tag>(existing);

        foreach (var name in normalized.Except(existing.Select(t => t.Name)))
        {
            var tag = new Tag { Id = Guid.NewGuid().ToString(), Name = name };
            db.Tags.Add(tag);
            result.Add(tag);
        }

        return result;
    }

    // Tags no longer referenced by any page — safe to drop from the registry.
    public async Task<int> RemoveUnusedTagsAsync()
    {
        var unused = await db.Tags.Where(t => !t.Pages.Any()).ToListAsync();
        db.Tags.RemoveRange(unused);
        await db.SaveChangesAsync();
        return unused.Count;
    }
}
