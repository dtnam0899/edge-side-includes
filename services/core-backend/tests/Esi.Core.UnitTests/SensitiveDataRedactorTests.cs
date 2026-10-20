using Esi.Core.Application.Logging;

namespace Esi.Core.UnitTests;

public class SensitiveDataRedactorTests
{
    [Theory]
    [InlineData("Server=db;User Id=sa;Password=S3cret!;Encrypt=True", "Server=db;User Id=sa;Password=***;Encrypt=True")]
    [InlineData("Server=db;PWD = 'S3cret!';", "Server=db;PWD = ***;")]
    [InlineData("DefaultEndpointsProtocol=https;AccountKey=abc+def==;", "DefaultEndpointsProtocol=https;AccountKey=***;")]
    [InlineData("GET /x?api_key=abc123&page=2", "GET /x?api_key=***&page=2")]
    [InlineData("{\"user\":\"a\",\"password\":\"p\\\"w\"}", "{\"user\":\"a\",\"password\":\"***\"}")]
    [InlineData("{\"accessToken\": \"eyJ\"}", "{\"accessToken\": \"***\"}")]
    [InlineData("Authorization: Bearer eyJhbGciOi.eyJzdWIi.c2ln", "Authorization: ***")]
    [InlineData("headers authorization=Basic dXNlcjpwYXNz; next", "headers authorization=***; next")]
    [InlineData("{\"Authorization\": \"Bearer eyJhbGciOi.eyJzdWIi.c2ln\"}", "{\"Authorization\": \"***\"}")]
    [InlineData("Authorization=eyJhbGciOi.eyJzdWIi.c2ln", "Authorization=***")]
    public void Masks_secret_values(string input, string expected) =>
        Assert.Equal(expected, SensitiveDataRedactor.Redact(input));

    [Theory]
    [InlineData("Server=db;Database=esi_core;User Id=sa")]
    [InlineData("Request finished in 12 ms")]
    [InlineData("")]
    public void Leaves_text_without_secrets_unchanged(string input) =>
        Assert.Equal(input, SensitiveDataRedactor.Redact(input));

    [Fact]
    public void Returns_empty_for_null() => Assert.Equal(string.Empty, SensitiveDataRedactor.Redact(null));
}
