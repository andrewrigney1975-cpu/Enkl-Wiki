using EnklWiki.Api.Data;
using EnklWiki.Api.Dtos;
using EnklWiki.Api.Models;
using EnklWiki.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Controllers;

[ApiController]
[Route("api/pages")]
public class PagesController(AppDbContext db, PageHierarchyService hierarchy, TagService tagService) : ControllerBase
{
    private static PageSummaryDto ToSummary(Page p) => new(
        p.Id, p.Slug, p.ParentId, p.Title,
        p.Tags.Select(t => t.Id).ToList(),
        p.Archived, p.CreatedAt, p.UpdatedAt);

    [HttpGet]
    public async Task<ActionResult<List<PageSummaryDto>>> GetAll()
    {
        var pages = await db.Pages.Include(p => p.Tags).OrderBy(p => p.SortOrder).ToListAsync();
        return Ok(pages.Select(ToSummary).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PageSummaryDto>> GetOne(string id)
    {
        var page = await db.Pages.Include(p => p.Tags).FirstOrDefaultAsync(p => p.Id == id);
        return page is null ? NotFound() : Ok(ToSummary(page));
    }

    [HttpGet("{id}/body")]
    public async Task<ActionResult<PageBodyDto>> GetBody(string id)
    {
        var body = await db.Pages.Where(p => p.Id == id).Select(p => p.Body).FirstOrDefaultAsync();
        return body is null ? NotFound() : Ok(new PageBodyDto(body));
    }

    [Authorize]
    [HttpPut("{id}/body")]
    public async Task<IActionResult> PutBody(string id, PageBodyDto request)
    {
        var page = await db.Pages.FindAsync(id);
        if (page is null) return NotFound();

        page.Body = request.Body;
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<PageSummaryDto>> Create(CreatePageDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest("Title is required.");

        if (request.ParentId is not null && !await db.Pages.AnyAsync(p => p.Id == request.ParentId))
        {
            return BadRequest("parentId does not refer to an existing page.");
        }

        var now = DateTimeOffset.UtcNow;
        var page = new Page
        {
            Id = Guid.NewGuid().ToString(),
            Slug = await hierarchy.UniqueSlugAsync(PageHierarchyService.Slugify(request.Title)),
            ParentId = request.ParentId,
            Title = request.Title.Trim(),
            Archived = false,
            Body = string.Empty,
            SortOrder = await hierarchy.NextSortOrderAsync(request.ParentId),
            CreatedAt = now,
            UpdatedAt = now,
            Tags = await tagService.ResolveTagsAsync(request.TagNames ?? [])
        };

        db.Pages.Add(page);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = page.Id }, ToSummary(page));
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateMetadata(string id, UpdatePageMetadataDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest("Title is required.");

        var page = await db.Pages.Include(p => p.Tags).FirstOrDefaultAsync(p => p.Id == id);
        if (page is null) return NotFound();

        page.Title = request.Title.Trim();
        page.Tags = await tagService.ResolveTagsAsync(request.TagNames ?? []);
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpPut("{id}/parent")]
    public async Task<IActionResult> Reparent(string id, ReparentPageDto request)
    {
        var page = await db.Pages.FindAsync(id);
        if (page is null) return NotFound();

        if (request.NewParentId is not null)
        {
            if (!await db.Pages.AnyAsync(p => p.Id == request.NewParentId)) return BadRequest("newParentId does not refer to an existing page.");
            if (await hierarchy.WouldCreateCycleAsync(id, request.NewParentId)) return BadRequest("That move would create a cycle in the page hierarchy.");
        }

        page.ParentId = request.NewParentId;
        page.SortOrder = await hierarchy.NextSortOrderAsync(request.NewParentId);
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpPut("{id}/move")]
    public async Task<IActionResult> Move(string id, MovePageDto request)
    {
        if (request.Direction is not ("up" or "down")) return BadRequest("direction must be 'up' or 'down'.");
        if (!await db.Pages.AnyAsync(p => p.Id == id)) return NotFound();

        await hierarchy.MoveSiblingAsync(id, request.Direction);
        return NoContent();
    }

    [Authorize]
    [HttpPut("{id}/archived")]
    public async Task<IActionResult> SetArchived(string id, SetArchivedDto request)
    {
        var page = await db.Pages.FindAsync(id);
        if (page is null) return NotFound();

        page.Archived = request.Archived;
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromBody] DeletePageResolutionDto? resolution)
    {
        if (!await db.Pages.AnyAsync(p => p.Id == id)) return NotFound();

        var type = resolution?.Type ?? "cascade";
        if (type is not ("cascade" or "repoint" or "promote")) return BadRequest("resolution.type must be 'cascade', 'repoint' or 'promote'.");
        if (type == "repoint" && resolution?.NewParentId is null) return BadRequest("resolution.newParentId is required for 'repoint'.");

        await hierarchy.DeletePageWithChildrenAsync(id, type, resolution?.NewParentId);
        return NoContent();
    }
}
