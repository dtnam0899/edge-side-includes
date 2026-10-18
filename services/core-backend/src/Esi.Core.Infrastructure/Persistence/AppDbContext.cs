using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence;

/// <summary>The application's own database (never a user's target database).</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
}
