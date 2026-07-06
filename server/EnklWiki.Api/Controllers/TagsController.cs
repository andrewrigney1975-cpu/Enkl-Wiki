using EnklWiki.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnklWiki.Api.Controllers;

[ApiController]
[Route("api/tags")]
[Authorize]
public class TagsController(TagService tagService) : ControllerBase
{
    [HttpDelete("unused")]
    public async Task<IActionResult> DeleteUnused()
    {
        var removed = await tagService.RemoveUnusedTagsAsync();
        return Ok(new { removed });
    }
}
