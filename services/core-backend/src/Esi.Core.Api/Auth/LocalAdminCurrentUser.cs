using Esi.Core.Application.Abstractions;

namespace Esi.Core.Api.Auth;

/// <summary>
/// Local development and integration tests only: every request acts as one local admin user. Enabled only by
/// <c>ESI_CORE_Auth__Mode=LocalAdmin</c> together with <c>ASPNETCORE_ENVIRONMENT=Development</c> (ADR-0006).
/// </summary>
public sealed class LocalAdminCurrentUser(Guid userId) : ICurrentUser
{
    public const string Mode = "LocalAdmin";

    /// <summary>Default id of the local admin when <c>ESI_CORE_Auth__LocalUserId</c> is not set.</summary>
    public static readonly Guid DefaultUserId = new("00000000-0000-0000-0000-000000000001");

    public Guid UserId { get; } = userId;
}
