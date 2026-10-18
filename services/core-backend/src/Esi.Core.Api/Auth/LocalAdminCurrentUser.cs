using Esi.Core.Application.Abstractions;

namespace Esi.Core.Api.Auth;

/// <summary>
/// Stand-in until an identity provider exists (SR-9): every request acts as one local admin user. It is enabled
/// only by <c>ESI_CORE_Auth__Mode=LocalAdmin</c>, so a deployment without that explicit setting does not start.
/// </summary>
public sealed class LocalAdminCurrentUser(Guid userId) : ICurrentUser
{
    public const string Mode = "LocalAdmin";

    /// <summary>Default id of the local admin when <c>ESI_CORE_Auth__LocalUserId</c> is not set.</summary>
    public static readonly Guid DefaultUserId = new("00000000-0000-0000-0000-000000000001");

    public Guid UserId { get; } = userId;
}
