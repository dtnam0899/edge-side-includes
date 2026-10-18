using Esi.Core.Application.Consent;
using Contracts = Esi.Core.Api.Contracts;
using Model = Esi.Core.Domain.Connections;

namespace Esi.Core.Api.Endpoints;

/// <summary>Maps application results to the generated contract DTOs (core-api 0.1.0). No secret field exists on them.</summary>
internal static class ContractMapping
{
    public static Contracts.Connection ToContract(this Model.Connection connection) => new()
    {
        Id = connection.Id,
        Name = connection.Name,
        Server = connection.Server,
        Database = connection.Database,
        Consent = connection.Consent == Model.ConsentState.Granted
            ? Contracts.ConnectionConsent.Granted
            : Contracts.ConnectionConsent.Withdrawn,
        CreatedAt = connection.CreatedAt,
        UpdatedAt = connection.UpdatedAt,
    };

    public static Contracts.ConsentTerms ToContract(this ConsentTerms terms) => new()
    {
        Version = terms.Version,
        Text = terms.Text,
        Status = terms.Status == ConsentTermsStatus.Approved ? Contracts.ConsentTermsStatus.Approved : Contracts.ConsentTermsStatus.Draft,
        PublishedAt = terms.PublishedAt,
    };

    public static Contracts.ConsentAcceptance ToContract(this ConsentAcceptanceView acceptance) => new()
    {
        TermsVersion = acceptance.TermsVersion,
        AcceptedAt = acceptance.AcceptedAt,
        IsCurrent = acceptance.IsCurrent,
    };
}
