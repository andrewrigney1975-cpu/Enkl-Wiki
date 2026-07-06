using EnklWiki.Api.Data;
using EnklWiki.Api.Dtos;
using EnklWiki.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Controllers;

[ApiController]
[Route("api/site")]
public class SiteController(AppDbContext db, CredentialService credentialService) : ControllerBase
{
    // Public read — visitors can always browse, matching the existing
    // visitor/editor distinction from the client-only modes.
    [HttpGet]
    public async Task<ActionResult<SiteResponseDto>> Get()
    {
        var site = await db.Sites.FindAsync(1);
        if (site is null) return NotFound();

        var tags = await db.Tags.Select(t => new TagDto(t.Id, t.Name)).ToListAsync();
        var pages = await db.Pages
            .OrderBy(p => p.SortOrder)
            .Select(p => new PageSummaryDto(
                p.Id, p.Slug, p.ParentId, p.Title,
                p.Tags.Select(t => t.Id).ToList(),
                p.Archived, p.CreatedAt, p.UpdatedAt))
            .ToListAsync();
        var uploads = await db.Uploads
            .Select(u => new UploadDto(u.Id, u.FileName, u.OriginalFileName, u.ContentType, u.Size, u.CreatedAt))
            .ToListAsync();

        return Ok(new SiteResponseDto(site.Title, site.Description, tags, pages, uploads));
    }

    [Authorize]
    [HttpPut]
    public async Task<IActionResult> Update(SiteUpdateDto request)
    {
        var site = await db.Sites.FindAsync(1);
        if (site is null) return NotFound();

        site.Title = request.Title;
        site.Description = request.Description;
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Gated by the JWT obtained at login (POST /api/auth/login) — that
    // already proves knowledge of the current credential, so it isn't asked
    // for again here, matching the client-only modes' simplicity.
    [Authorize]
    [HttpPut("credential")]
    public async Task<IActionResult> ChangeCredential(ChangeCredentialDto request)
    {
        var site = await db.Sites.FindAsync(1);
        if (site is null) return NotFound();

        var (salt, hash) = credentialService.HashCredential(request.NewCredential);
        site.CredentialSalt = salt;
        site.CredentialHash = hash;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
