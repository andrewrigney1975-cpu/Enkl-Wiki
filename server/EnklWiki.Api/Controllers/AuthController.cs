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

        // Admin is checked first so a credential that (unusually) matches
        // both isn't mistaken for the lower tier.
        if (site.AdminCredentialSalt is not null && site.AdminCredentialHash is not null
            && credentialService.VerifyCredential(request.Credential, site.AdminCredentialSalt, site.AdminCredentialHash))
        {
            return Ok(new LoginResponseDto(credentialService.IssueToken("admin"), "admin"));
        }

        if (!credentialService.VerifyCredential(request.Credential, site.CredentialSalt, site.CredentialHash))
        {
            return Unauthorized();
        }

        return Ok(new LoginResponseDto(credentialService.IssueToken("editor"), "editor"));
    }
}
