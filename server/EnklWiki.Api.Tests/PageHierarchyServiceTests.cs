using EnklWiki.Api.Data;
using EnklWiki.Api.Models;
using EnklWiki.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EnklWiki.Api.Tests;

public class PageHierarchyServiceTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Page NewPage(string id, string? parentId, int sortOrder = 0) => new()
    {
        Id = id,
        Slug = id,
        ParentId = parentId,
        Title = id,
        SortOrder = sortOrder,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };

    [Theory]
    [InlineData("Hello World", "hello-world")]
    [InlineData("  Trim Me  ", "trim-me")]
    [InlineData("Café Déjà Vu", "cafe-deja-vu")]
    [InlineData("!!!", "")]
    public void Slugify_matches_the_client_side_semantics(string input, string expected)
    {
        Assert.Equal(expected, PageHierarchyService.Slugify(input));
    }

    [Fact]
    public async Task UniqueSlugAsync_returns_the_base_slug_when_unused()
    {
        await using var db = CreateDb();
        var service = new PageHierarchyService(db);

        Assert.Equal("hello", await service.UniqueSlugAsync("hello"));
    }

    [Fact]
    public async Task UniqueSlugAsync_appends_a_number_on_collision()
    {
        await using var db = CreateDb();
        db.Pages.Add(NewPage("hello", null));
        db.Pages.Add(NewPage("hello-2", null));
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        Assert.Equal("hello-3", await service.UniqueSlugAsync("hello"));
    }

    [Fact]
    public async Task UniqueSlugAsync_excludes_the_page_being_renamed_from_the_collision_check()
    {
        await using var db = CreateDb();
        var page = NewPage("p1", null);
        page.Slug = "hello";
        db.Pages.Add(page);
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        Assert.Equal("hello", await service.UniqueSlugAsync("hello", excludePageId: "p1"));
    }

    [Fact]
    public async Task GetDescendantIdsAsync_returns_children_and_grandchildren_but_not_siblings()
    {
        await using var db = CreateDb();
        db.Pages.AddRange(
            NewPage("root", null),
            NewPage("child", "root"),
            NewPage("grandchild", "child"),
            NewPage("sibling", null)
        );
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        var descendants = await service.GetDescendantIdsAsync("root");

        Assert.Contains("child", descendants);
        Assert.Contains("grandchild", descendants);
        Assert.DoesNotContain("sibling", descendants);
    }

    [Fact]
    public async Task WouldCreateCycleAsync_is_true_for_self_and_descendants()
    {
        await using var db = CreateDb();
        db.Pages.AddRange(NewPage("root", null), NewPage("child", "root"));
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        Assert.True(await service.WouldCreateCycleAsync("root", "root"));
        Assert.True(await service.WouldCreateCycleAsync("root", "child"));
        Assert.False(await service.WouldCreateCycleAsync("child", "root"));
    }

    [Fact]
    public async Task MoveSiblingAsync_swaps_sort_order_with_the_previous_sibling_and_is_a_noop_at_the_start()
    {
        await using var db = CreateDb();
        db.Pages.AddRange(NewPage("a", null, 0), NewPage("b", null, 1), NewPage("c", null, 2));
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        await service.MoveSiblingAsync("b", "up");

        Assert.Equal(1, (await db.Pages.FindAsync("a"))!.SortOrder);
        Assert.Equal(0, (await db.Pages.FindAsync("b"))!.SortOrder);

        await service.MoveSiblingAsync("b", "up"); // now at the front — no-op
        Assert.Equal(0, (await db.Pages.FindAsync("b"))!.SortOrder);
    }

    [Fact]
    public async Task DeletePageWithChildrenAsync_cascade_removes_the_page_and_all_descendants()
    {
        await using var db = CreateDb();
        db.Pages.AddRange(NewPage("root", null), NewPage("child", "root"), NewPage("grandchild", "child"));
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        await service.DeletePageWithChildrenAsync("root", "cascade", null);

        Assert.Empty(db.Pages);
    }

    [Fact]
    public async Task DeletePageWithChildrenAsync_promote_makes_the_top_most_child_top_level_and_nests_the_rest_under_it()
    {
        await using var db = CreateDb();
        db.Pages.AddRange(
            NewPage("root", null),
            NewPage("child1", "root", 0),
            NewPage("child2", "root", 1)
        );
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        await service.DeletePageWithChildrenAsync("root", "promote", null);

        Assert.Null((await db.Pages.FindAsync("child1"))!.ParentId);
        Assert.Equal("child1", (await db.Pages.FindAsync("child2"))!.ParentId);
        Assert.Null(await db.Pages.FindAsync("root"));
    }

    [Fact]
    public async Task DeletePageWithChildrenAsync_repoint_reparents_the_top_most_child_to_the_given_parent()
    {
        await using var db = CreateDb();
        db.Pages.AddRange(NewPage("root", null), NewPage("elsewhere", null), NewPage("child1", "root", 0));
        await db.SaveChangesAsync();

        var service = new PageHierarchyService(db);
        await service.DeletePageWithChildrenAsync("root", "repoint", "elsewhere");

        Assert.Equal("elsewhere", (await db.Pages.FindAsync("child1"))!.ParentId);
    }
}
