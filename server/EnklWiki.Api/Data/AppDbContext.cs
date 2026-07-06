using EnklWiki.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EnklWiki.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Site> Sites => Set<Site>();
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Upload> Uploads => Set<Upload>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Site>().HasData(new Site { Id = 1 });

        modelBuilder.Entity<Page>()
            .HasIndex(p => p.Slug)
            .IsUnique();

        modelBuilder.Entity<Page>()
            .HasIndex(p => p.ParentId);

        modelBuilder.Entity<Tag>()
            .HasIndex(t => t.Name)
            .IsUnique();

        modelBuilder.Entity<Upload>()
            .HasIndex(u => u.FileName)
            .IsUnique();

        // Implicit many-to-many Page <-> Tag, matching the client's tagIds arrays.
        modelBuilder.Entity<Page>()
            .HasMany(p => p.Tags)
            .WithMany(t => t.Pages)
            .UsingEntity(j => j.ToTable("PageTags"));
    }
}
