namespace Esi.Core.Application.Abstractions;

/// <summary>The authenticated user. Until an identity provider exists this is the assumed local admin (SR-9).</summary>
public interface ICurrentUser
{
    Guid UserId { get; }
}
