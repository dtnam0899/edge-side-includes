using Esi.Core.Api.Contracts;
using Esi.Core.Application.Consent;

namespace Esi.Core.Api.Endpoints;

internal static class ConsentEndpoints
{
    public static IEndpointRouteBuilder MapConsentEndpoints(this IEndpointRouteBuilder app)
    {
        var consent = app.MapGroup("/consent").WithTags("Consent");

        consent.MapGet("/terms", (ConsentService service) => Results.Ok(service.GetCurrentTerms().ToContract()))
            .WithName("getConsentTerms");

        consent.MapGet("/acceptance", async (ConsentService service, CancellationToken ct) =>
                Results.Ok((await service.GetAcceptanceAsync(ct)).ToContract()))
            .WithName("getConsentAcceptance");

        consent.MapPost("/acceptance", async (AcceptConsentRequest? request, ConsentService service, CancellationToken ct) =>
            {
                var accepted = await service.AcceptAsync(request?.TermsVersion ?? string.Empty, ct);
                return Results.Created("/consent/acceptance", accepted.ToContract());
            })
            .WithName("acceptConsentTerms");

        return app;
    }
}
