using EnklWiki.Api.Data;
using EnklWiki.Api.Dtos;
using EnklWiki.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Controllers;

[ApiController]
public class ImportExportController(AppDbContext db) : ControllerBase
{
    // Full-fidelity backup: unlike the client's own exportConfig() (which can
    // only serialize page bodies currently loaded in memory), every page's
    // body is already in the DB, so this always inlines everything.
    [HttpGet("api/export")]
    public async Task<ActionResult<ExportSiteDto>> Export()
    {
        var site = await db.Sites.FindAsync(1);
        if (site is null) return NotFound();

        var tags = await db.Tags.Select(t => new TagDto(t.Id, t.Name)).ToListAsync();
        var pages = await db.Pages
            .OrderBy(p => p.SortOrder)
            .Select(p => new PageExportDto(
                p.Id, p.Slug, p.ParentId, p.Title,
                p.Tags.Select(t => t.Id).ToList(),
                p.Archived, p.Body, p.CreatedAt, p.UpdatedAt))
            .ToListAsync();
        var uploads = await db.Uploads
            .Select(u => new UploadDto(u.Id, u.FileName, u.OriginalFileName, u.ContentType, u.Size, u.CreatedAt))
            .ToListAsync();

        return Ok(new ExportSiteDto(new ExportSiteInfoDto(site.Title, site.Description), tags, pages, uploads));
    }

    // Replace-all: mirrors the client's replaceConfig(), used as the on-ramp
    // for migrating an existing embedded/filesystem site into rdbms mode.
    // Tags and pages are fully replaced; uploads are left untouched since no
    // binary content travels in this JSON payload (existing embedded/
    // filesystem uploads referenced by imported pages must be re-uploaded).
    // Only ever invoked from Site Settings on the client, so it requires the
    // admin credential.
    [Authorize(Roles = "admin")]
    [HttpPost("api/import")]
    public async Task<IActionResult> Import(ImportSiteDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Site.Title)) return BadRequest("site.title is required.");

        var incomingIds = new HashSet<string>(request.Pages.Select(p => p.Id));
        foreach (var p in request.Pages)
        {
            if (p.ParentId is not null && !incomingIds.Contains(p.ParentId))
            {
                return BadRequest($"Page '{p.Id}' has parentId '{p.ParentId}' which is not present in the import payload.");
            }
        }

        // The InMemory provider (used by the xUnit test suite) doesn't support
        // transactions — only wrap this in one against a real relational
        // database, where a partial replace-all on failure would be bad.
        var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync() : null;
        await using var _ = transaction;

        db.Pages.RemoveRange(db.Pages);
        db.Tags.RemoveRange(db.Tags);
        await db.SaveChangesAsync();

        var tagsById = (request.Tags ?? [])
            .GroupBy(t => t.Id)
            .Select(g => g.First())
            .ToDictionary(t => t.Id, t => new Tag { Id = t.Id, Name = t.Name });
        db.Tags.AddRange(tagsById.Values);

        var now = DateTimeOffset.UtcNow;
        var sortOrders = new Dictionary<string, int>();
        foreach (var p in request.Pages)
        {
            var parentKey = p.ParentId ?? string.Empty;
            sortOrders[parentKey] = sortOrders.TryGetValue(parentKey, out var n) ? n + 1 : 0;

            db.Pages.Add(new Page
            {
                Id = p.Id,
                Slug = p.Slug,
                ParentId = p.ParentId,
                Title = p.Title,
                Archived = p.Archived,
                Body = p.Body ?? string.Empty,
                SortOrder = sortOrders[parentKey],
                CreatedAt = p.CreatedAt ?? now,
                UpdatedAt = p.UpdatedAt ?? now,
                Tags = (p.TagIds ?? []).Where(tagsById.ContainsKey).Select(id => tagsById[id]).ToList()
            });
        }

        var site = await db.Sites.FindAsync(1);
        if (site is not null)
        {
            site.Title = request.Site.Title;
            site.Description = request.Site.Description ?? string.Empty;
        }

        await db.SaveChangesAsync();
        if (transaction is not null) await transaction.CommitAsync();

        return NoContent();
    }
}
