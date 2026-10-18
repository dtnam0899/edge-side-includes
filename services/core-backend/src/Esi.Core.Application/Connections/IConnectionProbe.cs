using Esi.Core.Application.Security;

namespace Esi.Core.Application.Connections;

/// <summary>Outcome of opening a connection. <see cref="FailureReason"/> is safe to show: it never holds a secret.</summary>
public sealed record ConnectionProbeResult(bool Succeeded, string? ServerVersion, int DurationMs, string? FailureReason);

public interface IConnectionProbe
{
    Task<ConnectionProbeResult> OpenAsync(SecretValue connectionString, CancellationToken cancellationToken);
}
