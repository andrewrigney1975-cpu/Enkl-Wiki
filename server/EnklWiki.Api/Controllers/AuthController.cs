using EnklWiki.Api.Data;
using EnklWiki.Api.Dtos;
using EnklWiki.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EnklWiki.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, CredentialService credentialService) : ControllerBase
{
    // Public: anyone can attempt to unlock editing, same as the client-only
    // modes today. Reads elsewhere never require a token.
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
    {
        var site = await db.Sites.FindAsync(1);
        if (site?.CredentialSalt is null || site.CredentialHash is null)
        {
            return Problem("Site credential is not configured.", statusCode: StatusCodes.Status500InternalServerError);
        }

        if (!credentialService.VerifyCredential(request.Credential, site.CredentialSalt, site.CredentialHash))
        {
            return Unauthorized();
        }

        return Ok(new LoginResponseDto(credentialService.IssueToken()));
    }
}
