using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using EnklWiki.Api.Data;
using EnklWiki.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Services;

// Ports the slug/orphan/reorder semantics from the client's
// src/content/page-model.js so the two backing stores behave identically.
public partial class PageHierarchyService(AppDbContext db)
{
    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphaNumeric();

    public static string Slugify(string? text)
    {
        var normalized = (text ?? string.Empty).ToLowerInvariant().Normalize(NormalizationForm.FormKD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        var slug = NonAlphaNumeric().Replace(sb.ToString(), "-").Trim('-');
        return slug.Length > 80 ? slug[..80] : slug;
    }

    public async Task<string> UniqueSlugAsync(string baseSlug, string? excludePageId = null)
    {
        var candidate = string.IsNullOrEmpty(baseSlug) ? "page" : baseSlug;
        if (!await SlugExistsAsync(candidate, excludePageId)) return candidate;

        var i = 2;
        while (await SlugExistsAsync($"{candidate}-{i}", excludePageId)) i++;
        return $"{candidate}-{i}";
    }

    private Task<bool> SlugExistsAsync(string slug, string? excludePageId) =>
        db.Pages.AnyAsync(p => p.Slug == slug && p.Id != excludePageId);

    // Every descendant id (children, grandchildren, ...) of pageId, flattened.
    public async Task<List<string>> GetDescendantIdsAsync(string pageId)
    {
        var allPages = await db.Pages.Select(p => new { p.Id, p.ParentId }).ToListAsync();
        var result = new List<string>();
        var stack = new Stack<string>();
        stack.Push(pageId);
        while (stack.Count > 0)
        {
            var current = stack.Pop();
            foreach (var p in allPages.Where(p => p.ParentId == current))
            {
                result.Add(p.Id);
                stack.Push(p.Id);
            }
        }
        return result;
    }

    // True if candidateParentId is pageId itself or one of its descendants —
    // reparenting onto one of these would create a cycle.
    public async Task<bool> WouldCreateCycleAsync(string pageId, string candidateParentId)
    {
        if (pageId == candidateParentId) return true;
        var descendants = await GetDescendantIdsAsync(pageId);
        return descendants.Contains(candidateParentId);
    }

    // Swaps pageId with its previous/next sibling (shared ParentId) by
    // SortOrder. No-op at either end of the sibling list.
    public async Task MoveSiblingAsync(string pageId, string direction)
    {
        var page = await db.Pages.FindAsync(pageId) ?? throw new KeyNotFoundException("Page not found");
        var siblings = await db.Pages
            .Where(p => p.ParentId == page.ParentId)
            .OrderBy(p => p.SortOrder)
            .ToListAsync();

        var index = siblings.FindIndex(p => p.Id == pageId);
        var swapWith = direction == "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= siblings.Count) return;

        (siblings[index].SortOrder, siblings[swapWith].SortOrder) = (siblings[swapWith].SortOrder, siblings[index].SortOrder);
        await db.SaveChangesAsync();
    }

    public async Task<int> NextSortOrderAsync(string? parentId)
    {
        var max = await db.Pages.Where(p => p.ParentId == parentId).Select(p => (int?)p.SortOrder).MaxAsync();
        return (max ?? -1) + 1;
    }

    // Deletes pageId. If it has children, resolution decides their fate:
    //  - "cascade": the page and all descendants are removed.
    //  - "repoint": the top-most child is reparented to newParentId; any
    //    other direct children are nested under that child.
    //  - "promote": the top-most child becomes top-level; any other direct
    //    children are nested under that child.
    public async Task DeletePageWithChildrenAsync(string pageId, string resolutionType, string? newParentId)
    {
        var children = await db.Pages.Where(p => p.ParentId == pageId).OrderBy(p => p.SortOrder).ToListAsync();

        if (children.Count == 0 || resolutionType == "cascade")
        {
            var toRemoveIds = new HashSet<string>(await GetDescendantIdsAsync(pageId)) { pageId };
            var toRemove = await db.Pages.Where(p => toRemoveIds.Contains(p.Id)).ToListAsync();
            db.Pages.RemoveRange(toRemove);
        }
        else
        {
            var topMost = children[0];
            topMost.ParentId = resolutionType == "repoint" ? newParentId : null;
            foreach (var child in children.Skip(1))
            {
                child.ParentId = topMost.Id;
            }
            var page = await db.Pages.FindAsync(pageId);
            if (page is not null) db.Pages.Remove(page);
        }

        await db.SaveChangesAsync();
    }
}
