using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Esi.Core.Infrastructure.Persistence;

/// <summary>Used by <c>dotnet ef</c> and the migrations bundle; reads the same variable as the API.</summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Adding a migration needs no connection; commands that connect take --connection or the variable.
        var connectionString = Environment.GetEnvironmentVariable(DependencyInjection.ConnectionStringVariable)
            ?? "Host=localhost;Database=esi_core";
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DependencyInjection.ConfigureNpgsql(options, connectionString);
        return new AppDbContext(options.Options);
    }
}
