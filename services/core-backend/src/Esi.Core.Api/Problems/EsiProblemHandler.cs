using Esi.Core.Application.Problems;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Esi.Core.Api.Problems;

/// <summary>
/// Turns <see cref="EsiProblem"/> into <c>application/problem+json</c> with <c>type: urn:esi:problem:&lt;name&gt;</c>.
/// Any other exception becomes a generic 500 whose body never contains the exception message.
/// </summary>
public sealed partial class EsiProblemHandler(IProblemDetailsService problems, ILogger<EsiProblemHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ProblemDetails details;
        switch (exception)
        {
            case EsiProblem problem:
                details = new ProblemDetails
                {
                    Type = $"urn:esi:problem:{problem.Name}",
                    Title = problem.Title,
                    Status = problem.Status,
                    Detail = problem.Detail,
                };
                if (problem.FieldErrors.Count > 0)
                {
                    details.Extensions["errors"] = problem.FieldErrors.Select(e => new { field = e.Field, message = e.Message }).ToArray();
                }

                break;
            case BadHttpRequestException bad:
                details = new ProblemDetails
                {
                    Type = "urn:esi:problem:invalid-request",
                    Title = "Invalid request",
                    Status = bad.StatusCode,
                    Detail = "The request body or parameters could not be read.",
                };
                break;
            default:
                LogUnhandled(logger, exception);
                details = new ProblemDetails { Type = "about:blank", Title = "Internal error", Status = StatusCodes.Status500InternalServerError };
                break;
        }

        httpContext.Response.StatusCode = details.Status ?? StatusCodes.Status500InternalServerError;
        details.Extensions["traceId"] = httpContext.TraceIdentifier;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = details, Exception = exception });
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception")]
    private static partial void LogUnhandled(ILogger logger, Exception exception);
}
