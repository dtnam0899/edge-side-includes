namespace Esi.Core.Domain.Users;

/// <summary>
/// Maps an identity-provider account (issuer + subject) to the internal user id every owner-scoped table uses
/// (ADR-0006). Provider ids never leave this table; email and name are not stored.
/// </summary>
public sealed class User
{
    public const int MaxIssuerLength = 255;
    public const int MaxSubjectLength = 255;

    private User()
    {
        Issuer = string.Empty;
        Subject = string.Empty;
    }

    public User(Guid id, string issuer, string subject, DateTimeOffset createdAt)
    {
        Id = id;
        Issuer = issuer;
        Subject = subject;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public string Issuer { get; private set; }

    public string Subject { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}
