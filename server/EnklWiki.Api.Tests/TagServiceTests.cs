using EnklWiki.Api.Data;
using EnklWiki.Api.Models;
using EnklWiki.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EnklWiki.Api.Tests;

public class TagServiceTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Theory]
    [InlineData("#Guide", "guide")]
    [InlineData("  Getting Started  ", "getting-started")]
    [InlineData("ALREADY-normalized", "already-normalized")]
    public void NormalizeTagName_strips_hash_lowercases_and_dashes_whitespace(string input, string expected)
    {
        Assert.Equal(expected, TagService.NormalizeTagName(input));
    }

    [Fact]
    public async Task ResolveTagsAsync_reuses_an_existing_tag_by_normalized_name()
    {
        await using var db = CreateDb();
        db.Tags.Add(new Tag { Id = "t1", Name = "guide" });
        await db.SaveChangesAsync();

        var service = new TagService(db);
        var tags = await service.ResolveTagsAsync(["#Guide"]);

        Assert.Single(tags);
        Assert.Equal("t1", tags[0].Id);
        Assert.Equal(1, await db.Tags.CountAsync());
    }

    [Fact]
    public async Task ResolveTagsAsync_creates_new_tags_and_dedupes_by_normalized_name()
    {
        await using var db = CreateDb();
        var service = new TagService(db);

        var tags = await service.ResolveTagsAsync(["Alpha", "alpha", "Beta"]);
        await db.SaveChangesAsync();

        Assert.Equal(2, tags.Count);
        Assert.Equal(2, await db.Tags.CountAsync());
    }

    [Fact]
    public async Task RemoveUnusedTagsAsync_removes_only_tags_with_no_pages()
    {
        await using var db = CreateDb();
        var used = new Tag { Id = "used", Name = "used" };
        var unused = new Tag { Id = "unused", Name = "unused" };
        db.Tags.AddRange(used, unused);
        db.Pages.Add(new Page
        {
            Id = "p1", Slug = "p1", Title = "P1", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            Tags = [used]
        });
        await db.SaveChangesAsync();

        var service = new TagService(db);
        var removed = await service.RemoveUnusedTagsAsync();

        Assert.Equal(1, removed);
        Assert.Equal(["used"], db.Tags.Select(t => t.Id).ToArray());
    }
}
