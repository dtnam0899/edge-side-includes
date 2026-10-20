using Esi.Core.Domain.Artifacts;
using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Connections;
using Esi.Core.Domain.Consent;
using Esi.Core.Domain.Dashboards;
using Esi.Core.Domain.Scripts;
using Esi.Core.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence;

/// <summary>The application's own database (never a user's target database).</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Connection> Connections => Set<Connection>();

    public DbSet<ConsentAcceptance> ConsentAcceptances => Set<ConsentAcceptance>();

    public DbSet<ChatSession> ChatSessions => Set<ChatSession>();

    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    public DbSet<Script> Scripts => Set<Script>();

    public DbSet<Artifact> Artifacts => Set<Artifact>();

    public DbSet<Dashboard> Dashboards => Set<Dashboard>();

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
