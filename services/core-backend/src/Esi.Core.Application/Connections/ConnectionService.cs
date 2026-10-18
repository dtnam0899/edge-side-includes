using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Security;
using Esi.Core.Domain.Connections;

namespace Esi.Core.Application.Connections;

/// <summary>Use cases for the current user's connections. Plaintext connection strings exist only inside a call.</summary>
public sealed class ConnectionService(
    ICurrentUser user,
    IConnectionRepository connections,
    ConnectionAccess access,
    ConsentService consent,
    ISecretProtector protector,
    IConnectionStringInspector inspector,
    IConnectionProbe probe,
    TimeProvider clock)
{
    public Task<IReadOnlyList<Connection>> ListAsync(CancellationToken cancellationToken) =>
        connections.ListByOwnerAsync(user.UserId, cancellationToken);

    public Task<Connection> GetAsync(Guid id, CancellationToken cancellationToken) => access.GetOwnedAsync(id, cancellationToken);

    public async Task<Connection> CreateAsync(string? name, string? connectionString, CancellationToken cancellationToken)
    {
        var validName = ValidateName(name);
        var secret = RequireConnectionString(connectionString);
        await consent.EnsureCurrentTermsAcceptedAsync(cancellationToken);
        var target = Inspect(secret);

        var id = Guid.NewGuid();
        var encrypted = protector.Protect(secret, new SecretBinding(id, user.UserId));
        var connection = new Connection(id, user.UserId, validName, target.Server, target.Database, encrypted, clock.GetUtcNow());
        connections.Add(connection);
        await connections.SaveChangesAsync(cancellationToken);
        return connection;
    }

    public async Task<Connection> UpdateAsync(Guid id, string? name, string? connectionString, CancellationToken cancellationToken)
    {
        var validName = ValidateName(name);
        var secret = connectionString is null ? null : RequireConnectionString(connectionString);
        var connection = await access.GetUsableAsync(id, cancellationToken);

        var now = clock.GetUtcNow();
        connection.Rename(validName, now);
        if (secret is not null)
        {
            var target = Inspect(secret);
            connection.ReplaceSecret(target.Server, target.Database, protector.Protect(secret, Binding(connection)), now);
        }

        await connections.SaveChangesAsync(cancellationToken);
        return connection;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var connection = await access.GetOwnedAsync(id, cancellationToken);
        connections.Remove(connection);
        await connections.SaveChangesAsync(cancellationToken);
    }

    public async Task<ConnectionProbeResult> TestAsync(Guid id, CancellationToken cancellationToken)
    {
        var connection = await access.GetUsableAsync(id, cancellationToken);
        var result = await probe.OpenAsync(protector.Unprotect(connection.Secret, Binding(connection)), cancellationToken);
        return result.Succeeded ? result : throw EsiProblem.ConnectionFailed(result.FailureReason ?? "The connection failed.");
    }

    public async Task<Connection> GrantConsentAsync(Guid id, CancellationToken cancellationToken)
    {
        var connection = await access.GetOwnedAsync(id, cancellationToken);
        await consent.EnsureCurrentTermsAcceptedAsync(cancellationToken);
        connection.GrantConsent(clock.GetUtcNow());
        await connections.SaveChangesAsync(cancellationToken);
        return connection;
    }

    public async Task WithdrawConsentAsync(Guid id, CancellationToken cancellationToken)
    {
        var connection = await access.GetOwnedAsync(id, cancellationToken);
        connection.WithdrawConsent(clock.GetUtcNow());
        await connections.SaveChangesAsync(cancellationToken);
    }

    private static SecretBinding Binding(Connection connection) => new(connection.Id, connection.OwnerId);

    private static string ValidateName(string? name)
    {
        var trimmed = name?.Trim();
        return string.IsNullOrEmpty(trimmed) || trimmed.Length > Connection.MaxNameLength
            ? throw EsiProblem.InvalidRequest(("name", $"Required, 1 to {Connection.MaxNameLength} characters."))
            : trimmed;
    }

    private static SecretValue RequireConnectionString(string? connectionString) =>
        string.IsNullOrWhiteSpace(connectionString)
            ? throw EsiProblem.InvalidRequest(("connectionString", "Required."))
            : new SecretValue(connectionString);

    private ConnectionTarget Inspect(SecretValue secret) =>
        inspector.Inspect(secret)
            ?? throw EsiProblem.InvalidRequest(("connectionString", "Not a valid SQL Server connection string with a server and a database."));
}
