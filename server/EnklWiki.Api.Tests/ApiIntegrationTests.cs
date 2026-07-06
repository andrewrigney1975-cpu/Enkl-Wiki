using System.Net;
using System.Net.Http.Json;
using EnklWiki.Api.Dtos;
using Xunit;

namespace EnklWiki.Api.Tests;

// Each test gets its own factory (and therefore its own isolated InMemory
// database) rather than sharing one via IClassFixture, so tests can run in
// any order without interfering with each other's data.
public class ApiIntegrationTests
{
    // Tuples can't be used with `using var`, and each test needs both the
    // factory and its client disposed together at the end of the test.
    private sealed class TestClient(TestWebApplicationFactory factory) : IDisposable
    {
        public HttpClient Client { get; } = factory.CreateClient();
        public void Dispose()
        {
            Client.Dispose();
            factory.Dispose();
        }
    }

    private static TestClient NewClient() => new(new TestWebApplicationFactory());

    private static async Task<string> LoginAsync(HttpClient client, string credential = "foobar")
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto(credential));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<LoginResponseDto>();
        return body!.Token;
    }

    // Site Settings actions (title/description, either credential, tag
    // pruning, import) require the admin credential, seeded by default as
    // "siteadmin" alongside the editor default "foobar".
    private static Task<string> AdminLoginAsync(HttpClient client) => LoginAsync(client, "siteadmin");

    private static void Authorize(HttpClient client, string token) =>
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

    [Fact]
    public async Task Health_endpoint_returns_200()
    {
        using var test = NewClient();
        var client = test.Client;
        var res = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task GetSite_is_public_and_returns_the_seeded_empty_site()
    {
        using var test = NewClient();
        var client = test.Client;
        var site = await client.GetFromJsonAsync<SiteResponseDto>("/api/site");

        Assert.Equal("Enkl-Wiki", site!.Title);
        Assert.Empty(site.Pages);
    }

    [Fact]
    public async Task Login_with_the_default_credential_succeeds_and_the_wrong_one_is_rejected()
    {
        using var test = NewClient();
        var client = test.Client;

        var ok = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("foobar"));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var okBody = await ok.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.Equal("editor", okBody!.Role);

        var bad = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
    }

    [Fact]
    public async Task Login_with_the_admin_credential_returns_the_admin_role()
    {
        using var test = NewClient();
        var client = test.Client;

        var res = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("siteadmin"));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.Equal("admin", body!.Role);
    }

    [Fact]
    public async Task Creating_a_page_without_a_token_is_rejected()
    {
        using var test = NewClient();
        var client = test.Client;
        var res = await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Untitled", null, null));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Full_page_lifecycle_create_body_rename_archive_delete()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var createRes = await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Getting Started", null, ["guide", "intro"]));
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var page = await createRes.Content.ReadFromJsonAsync<PageSummaryDto>();
        Assert.Equal("getting-started", page!.Slug);
        Assert.Equal(2, page.TagIds.Count);

        var putBody = await client.PutAsJsonAsync($"/api/pages/{page.Id}/body", new PageBodyDto("# Hello"));
        Assert.Equal(HttpStatusCode.NoContent, putBody.StatusCode);

        var body = await client.GetFromJsonAsync<PageBodyDto>($"/api/pages/{page.Id}/body");
        Assert.Equal("# Hello", body!.Body);

        var rename = await client.PutAsJsonAsync($"/api/pages/{page.Id}", new UpdatePageMetadataDto("Renamed", ["guide"]));
        Assert.Equal(HttpStatusCode.NoContent, rename.StatusCode);
        var afterRename = await client.GetFromJsonAsync<PageSummaryDto>($"/api/pages/{page.Id}");
        Assert.Equal("Renamed", afterRename!.Title);
        Assert.Single(afterRename.TagIds);

        var archive = await client.PutAsJsonAsync($"/api/pages/{page.Id}/archived", new SetArchivedDto(true));
        Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);
        Assert.True((await client.GetFromJsonAsync<PageSummaryDto>($"/api/pages/{page.Id}"))!.Archived);

        var delete = await client.DeleteAsync($"/api/pages/{page.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/pages/{page.Id}")).StatusCode);
    }

    [Fact]
    public async Task Reparenting_a_page_onto_its_own_descendant_is_rejected_with_400()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var root = (await (await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Root", null, null))).Content.ReadFromJsonAsync<PageSummaryDto>())!;
        var child = (await (await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Child", root.Id, null))).Content.ReadFromJsonAsync<PageSummaryDto>())!;

        var res = await client.PutAsJsonAsync($"/api/pages/{root.Id}/parent", new ReparentPageDto(child.Id));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Deleting_a_page_with_children_using_promote_makes_the_top_most_child_top_level()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var root = (await (await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Root", null, null))).Content.ReadFromJsonAsync<PageSummaryDto>())!;
        var child = (await (await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Child", root.Id, null))).Content.ReadFromJsonAsync<PageSummaryDto>())!;

        var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/pages/{root.Id}")
        {
            Content = JsonContent.Create(new DeletePageResolutionDto("promote", null))
        };
        var res = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        var childAfter = await client.GetFromJsonAsync<PageSummaryDto>($"/api/pages/{child.Id}");
        Assert.Null(childAfter!.ParentId);
    }

    [Fact]
    public async Task Upload_then_download_round_trips_the_file_bytes()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        using var form = new MultipartFormDataContent();
        var bytes = "fake png bytes"u8.ToArray();
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "photo.png");

        var uploadRes = await client.PostAsync("/api/uploads", form);
        Assert.Equal(HttpStatusCode.OK, uploadRes.StatusCode);
        var upload = await uploadRes.Content.ReadFromJsonAsync<UploadDto>();

        var downloadRes = await client.GetAsync($"/api/uploads/{upload!.FileName}");
        Assert.Equal(HttpStatusCode.OK, downloadRes.StatusCode);
        Assert.Equal(bytes, await downloadRes.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Upload_rejects_a_disallowed_extension()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent("bad"u8.ToArray());
        form.Add(fileContent, "file", "script.exe");

        var res = await client.PostAsync("/api/uploads", form);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Import_replaces_all_pages_and_tags_then_export_returns_full_fidelity_bodies()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await AdminLoginAsync(client));

        var importPayload = new ImportSiteDto(
            new ImportSiteInfoDto("Imported Site", "from a test"),
            [new TagDto("t1", "guide")],
            [new ImportPageDto("p1", "home", null, "Home", ["t1"], false, "# Home body", null, null)]
        );

        var importRes = await client.PostAsJsonAsync("/api/import", importPayload);
        Assert.Equal(HttpStatusCode.NoContent, importRes.StatusCode);

        var export = await client.GetFromJsonAsync<ExportSiteDto>("/api/export");
        Assert.Equal("Imported Site", export!.Site.Title);
        Assert.Single(export.Pages);
        Assert.Equal("# Home body", export.Pages[0].Body);
        Assert.Equal(["t1"], export.Pages[0].TagIds);
    }

    [Fact]
    public async Task Import_without_a_token_is_rejected()
    {
        using var test = NewClient();
        var client = test.Client;
        var payload = new ImportSiteDto(new ImportSiteInfoDto("X", null), [], []);
        var res = await client.PostAsJsonAsync("/api/import", payload);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Import_with_an_editor_token_is_forbidden()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var payload = new ImportSiteDto(new ImportSiteInfoDto("X", null), [], []);
        var res = await client.PostAsJsonAsync("/api/import", payload);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Changing_the_credential_takes_effect_for_the_next_login()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await AdminLoginAsync(client));

        var change = await client.PutAsJsonAsync("/api/site/credential", new ChangeCredentialDto("newpass123", "editor"));
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        client.DefaultRequestHeaders.Authorization = null;
        var oldLogin = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("foobar"));
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);

        var newLogin = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("newpass123"));
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }

    [Fact]
    public async Task Changing_the_admin_credential_takes_effect_and_the_editor_credential_still_works()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await AdminLoginAsync(client));

        var change = await client.PutAsJsonAsync("/api/site/credential", new ChangeCredentialDto("newadminpass", "admin"));
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        client.DefaultRequestHeaders.Authorization = null;
        var oldAdminLogin = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("siteadmin"));
        Assert.Equal(HttpStatusCode.Unauthorized, oldAdminLogin.StatusCode);

        var newAdminLogin = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("newadminpass"));
        Assert.Equal(HttpStatusCode.OK, newAdminLogin.StatusCode);
        var newAdminBody = await newAdminLogin.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.Equal("admin", newAdminBody!.Role);

        var editorLogin = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto("foobar"));
        Assert.Equal(HttpStatusCode.OK, editorLogin.StatusCode);
    }

    [Fact]
    public async Task Changing_the_credential_with_an_editor_token_is_forbidden()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var change = await client.PutAsJsonAsync("/api/site/credential", new ChangeCredentialDto("newpass123", "editor"));
        Assert.Equal(HttpStatusCode.Forbidden, change.StatusCode);
    }

    [Fact]
    public async Task RemoveUnusedTags_deletes_only_tags_no_page_references()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await AdminLoginAsync(client));

        await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Page", null, ["used"]));
        // "orphan" only ever exists via import, since page creation always
        // attaches every tag it's given — seed it directly through import.
        var importPayload = new ImportSiteDto(
            new ImportSiteInfoDto("Site", null),
            [new TagDto("orphan-id", "orphan")],
            []
        );
        // Import replaces everything, so recreate the used page+tag afterwards.
        await client.PostAsJsonAsync("/api/import", importPayload);
        await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Page", null, ["used"]));

        var deleteRes = await client.DeleteAsync("/api/tags/unused");
        Assert.Equal(HttpStatusCode.OK, deleteRes.StatusCode);

        var site = await client.GetFromJsonAsync<SiteResponseDto>("/api/site");
        Assert.Single(site!.Tags);
        Assert.Equal("used", site.Tags[0].Name);
    }

    [Fact]
    public async Task RemoveUnusedTags_with_an_editor_token_is_forbidden()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var res = await client.DeleteAsync("/api/tags/unused");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Updating_site_title_with_an_editor_token_is_forbidden_but_an_admin_token_succeeds()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var forbidden = await client.PutAsJsonAsync("/api/site", new SiteUpdateDto("New Title", "New Description"));
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        Authorize(client, await AdminLoginAsync(client));
        var ok = await client.PutAsJsonAsync("/api/site", new SiteUpdateDto("New Title", "New Description"));
        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);

        var site = await client.GetFromJsonAsync<SiteResponseDto>("/api/site");
        Assert.Equal("New Title", site!.Title);
    }

    [Fact]
    public async Task An_editor_token_can_still_create_and_edit_pages()
    {
        using var test = NewClient();
        var client = test.Client;
        Authorize(client, await LoginAsync(client));

        var res = await client.PostAsJsonAsync("/api/pages", new CreatePageDto("Editor Page", null, null));
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }
}
