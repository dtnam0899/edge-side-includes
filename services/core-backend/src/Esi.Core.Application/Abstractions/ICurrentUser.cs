namespace Esi.Core.Application.Abstractions;

/// <summary>The authenticated user: the internal id mapped from the Oidc token (ADR-0006), or the local admin in Development.</summary>
public interface ICurrentUser
{
    Guid UserId { get; }
}
