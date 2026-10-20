using Esi.Core.Application.Users;
using Microsoft.AspNetCore.Authentication;

namespace Esi.Core.Api.Auth;

/// <summary>
/// Maps the validated token's (iss, sub) to the internal user id (<c>Users</c> table, created on first sight) and
/// exposes it as <see cref="OidcCurrentUser"/>. Anonymous requests (only the health checks) pass through unmapped.
/// </summary>
public sealed class OidcUserMappingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, OidcCurrentUser currentUser, UserService users)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var issuer = context.User.FindFirst("iss")?.Value;
            var subject = context.User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(issuer) || string.IsNullOrEmpty(subject))
            {
                await context.ChallengeAsync();
                return;
            }

            currentUser.Set(await users.ResolveAsync(issuer, subject, context.RequestAborted));
        }

        await next(context);
    }
}
