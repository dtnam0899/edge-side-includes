using Esi.Core.Domain.Connections;
using Esi.Core.Domain.Consent;
using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence;

/// <summary>The application's own database (never a user's target database).</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Connection> Connections => Set<Connection>();

    public DbSet<ConsentAcceptance> ConsentAcceptances => Set<ConsentAcceptance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
