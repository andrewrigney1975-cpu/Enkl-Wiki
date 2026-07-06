using EnklWiki.Api.Data;
using EnklWiki.Api.Dtos;
using EnklWiki.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Controllers;

[ApiController]
[Route("api/uploads")]
public class UploadsController(AppDbContext db, IConfiguration configuration) : ControllerBase
{
    private static readonly string[] AllowedExtensions = ["svg", "png", "jpg", "jpeg", "mp3", "mp4", "pdf"];
    private readonly FileExtensionContentTypeProvider _contentTypes = new();

    private string UploadsDirectory
    {
        get
        {
            var path = configuration["Uploads:Path"] ?? "uploads";
            Directory.CreateDirectory(path);
            return Path.GetFullPath(path);
        }
    }

    [HttpGet]
    public async Task<ActionResult<List<UploadDto>>> GetAll()
    {
        var uploads = await db.Uploads
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new UploadDto(u.Id, u.FileName, u.OriginalFileName, u.ContentType, u.Size, u.CreatedAt))
            .ToListAsync();
        return Ok(uploads);
    }

    [Authorize]
    [HttpPost]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<UploadDto>> Upload(IFormFile file)
    {
        if (file.Length == 0) return BadRequest("File is empty.");

        var ext = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
        {
            return BadRequest($"\".{ext}\" files aren't supported here. Allowed: {string.Join(", ", AllowedExtensions)}.");
        }

        var storedName = $"{Guid.NewGuid():N}.{ext}";
        var fullPath = Path.Combine(UploadsDirectory, storedName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        if (!_contentTypes.TryGetContentType(storedName, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        var upload = new Upload
        {
            Id = Guid.NewGuid().ToString(),
            FileName = storedName,
            OriginalFileName = file.FileName,
            ContentType = contentType,
            Size = file.Length,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Uploads.Add(upload);
        await db.SaveChangesAsync();

        return Ok(new UploadDto(upload.Id, upload.FileName, upload.OriginalFileName, upload.ContentType, upload.Size, upload.CreatedAt));
    }

    [HttpGet("{fileName}")]
    public async Task<IActionResult> Download(string fileName)
    {
        var upload = await db.Uploads.FirstOrDefaultAsync(u => u.FileName == fileName);
        if (upload is null) return NotFound();

        var fullPath = Path.Combine(UploadsDirectory, upload.FileName);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        return PhysicalFile(fullPath, upload.ContentType, upload.OriginalFileName);
    }
}
