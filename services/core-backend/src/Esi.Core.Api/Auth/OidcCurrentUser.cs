using Esi.Core.Application.Abstractions;

namespace Esi.Core.Api.Auth;

/// <summary>The caller's internal user id, set per request by <see cref="OidcUserMappingMiddleware"/> after the token is validated.</summary>
public sealed class OidcCurrentUser : ICurrentUser
{
    private Guid? _userId;

    public Guid UserId => _userId ?? throw new InvalidOperationException("No authenticated user on this request.");

    internal void Set(Guid userId) => _userId = userId;
}
