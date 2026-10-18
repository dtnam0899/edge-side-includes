using System.Text.RegularExpressions;

namespace Esi.Core.Application.Logging;

/// <summary>
/// Masks secret values (passwords, keys, tokens) in free text before it is logged.
/// Seed for the ADR-0003 rule that secrets never reach logs; extend the key list rather than bypassing it.
/// </summary>
public static partial class SensitiveDataRedactor
{
    public const string Mask = "***";

    // Connection-string and query-string style pairs: "Password=secret;" or "api_key=secret&".
    [GeneratedRegex(
        """(?<key>\b(?:password|pwd|accountkey|sharedaccesskey|client[_ ]?secret|api[_-]?key|access[_ ]?token|secret|token)\s*=\s*)(?<value>"[^"]*"|'[^']*'|[^;&,\s]*)""",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex KeyValuePattern();

    // JSON style pairs: "password": "secret".
    [GeneratedRegex(
        @"(?<key>""(?:password|pwd|accountKey|sharedAccessKey|clientSecret|client_secret|apiKey|api_key|accessToken|access_token|secret|token)""\s*:\s*)""(?:[^""\\]|\\.)*""",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex JsonPattern();

    public static string Redact(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text ?? string.Empty;
        }

        var result = KeyValuePattern().Replace(text, m => m.Groups["key"].Value + Mask);
        return JsonPattern().Replace(result, m => m.Groups["key"].Value + "\"" + Mask + "\"");
    }
}
