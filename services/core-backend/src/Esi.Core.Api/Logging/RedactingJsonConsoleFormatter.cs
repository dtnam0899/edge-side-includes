using System.Text;
using System.Text.Json;
using Esi.Core.Application.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace Esi.Core.Api.Logging;

/// <summary>
/// Structured JSON console output (one object per line) with every message, state value and exception
/// passed through <see cref="SensitiveDataRedactor"/>.
/// </summary>
public sealed class RedactingJsonConsoleFormatter(IOptionsMonitor<JsonConsoleFormatterOptions> options)
    : ConsoleFormatter(Name)
{
    public new const string Name = "esi-json";

    public override void Write<TState>(in LogEntry<TState> logEntry, IExternalScopeProvider? scopeProvider, TextWriter textWriter)
    {
        var message = logEntry.Formatter?.Invoke(logEntry.State, logEntry.Exception);
        if (message is null && logEntry.Exception is null)
        {
            return;
        }

        var writerOptions = options.CurrentValue.JsonWriterOptions;
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, writerOptions))
        {
            writer.WriteStartObject();
            writer.WriteString("timestamp", DateTimeOffset.UtcNow);
            writer.WriteString("level", logEntry.LogLevel.ToString());
            writer.WriteString("category", logEntry.Category);
            writer.WriteNumber("eventId", logEntry.EventId.Id);
            writer.WriteString("message", SensitiveDataRedactor.Redact(message));
            if (logEntry.Exception is not null)
            {
                writer.WriteString("exception", SensitiveDataRedactor.Redact(logEntry.Exception.ToString()));
            }

            if (logEntry.State is IReadOnlyList<KeyValuePair<string, object?>> state)
            {
                writer.WriteStartObject("state");
                foreach (var (key, value) in state)
                {
                    writer.WriteString(key, SensitiveDataRedactor.Redact(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture)));
                }

                writer.WriteEndObject();
            }

            writer.WriteEndObject();
        }

        textWriter.WriteLine(Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length));
    }
}
