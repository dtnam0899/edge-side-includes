using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;

namespace Esi.Core.Api.Auth;

/// <summary>401 for a missing or invalid bearer token as problem+json (<c>urn:esi:problem:unauthenticated</c>, core-api 0.2.0).</summary>
internal static class UnauthenticatedProblem
{
    public static async Task WriteAsync(JwtBearerChallengeContext context)
    {
        context.HandleResponse();
        var http = context.HttpContext;
        http.Response.StatusCode = StatusCodes.Status401Unauthorized;
        http.Response.Headers.WWWAuthenticate = "Bearer";
        var details = new ProblemDetails
        {
            Type = "urn:esi:problem:unauthenticated",
            Title = "Authentication required",
            Status = StatusCodes.Status401Unauthorized,
            Detail = "Send a valid access token for this API in the Authorization header.",
        };
        details.Extensions["traceId"] = http.TraceIdentifier;
        var problems = http.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = http, ProblemDetails = details });
    }
}
