using System.Text.Json;
using Esi.Core.Api.Logging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace Esi.Core.UnitTests;

public class RedactingJsonConsoleFormatterTests
{
    private const string Secret = "S3cret-Value!";

    [Fact]
    public void Writes_one_json_object_without_the_secret()
    {
        var output = Format(
            "Connecting with {ConnectionString}",
            $"Server=db;Password={Secret}",
            new InvalidOperationException($"Login failed: Password={Secret}"));

        Assert.DoesNotContain(Secret, output);
        using var json = JsonDocument.Parse(output);
        var root = json.RootElement;
        Assert.Equal("Warning", root.GetProperty("level").GetString());
        Assert.Equal("Connecting with Server=db;Password=***", root.GetProperty("message").GetString());
        Assert.Equal("Server=db;Password=***", root.GetProperty("state").GetProperty("ConnectionString").GetString());
        Assert.Contains("Password=***", root.GetProperty("exception").GetString());
    }

    private static string Format(string template, object arg, Exception exception)
    {
        // The structured state a logger message template produces.
        var state = new List<KeyValuePair<string, object?>> { new("ConnectionString", arg), new("{OriginalFormat}", template) };
        var message = template.Replace("{ConnectionString}", arg.ToString(), StringComparison.Ordinal);
        var entry = new LogEntry<List<KeyValuePair<string, object?>>>(
            LogLevel.Warning, "Test", new EventId(7), state, exception, (_, _) => message);
        var formatter = new RedactingJsonConsoleFormatter(new StaticOptions());
        using var writer = new StringWriter();
        formatter.Write(entry, null, writer);
        return writer.ToString().Trim();
    }

    private sealed class StaticOptions : IOptionsMonitor<JsonConsoleFormatterOptions>
    {
        public JsonConsoleFormatterOptions CurrentValue { get; } = new();

        public JsonConsoleFormatterOptions Get(string? name) => CurrentValue;

        public IDisposable? OnChange(Action<JsonConsoleFormatterOptions, string?> listener) => null;
    }
}
