using Esi.Core.Application.Connections;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Security;
using Esi.Core.Domain.Schema;

namespace Esi.Core.Application.Schema;

/// <summary>Reads the schema of a usable connection for the AI workflow (SR-1); no row values.</summary>
public sealed class SchemaService(ConnectionAccess access, ISecretProtector protector, ITargetDatabase target)
{
    public async Task<SchemaMetadata> GetAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await access.GetUsableAsync(connectionId, cancellationToken);
        var secret = protector.Unprotect(connection.Secret, new SecretBinding(connection.Id, connection.OwnerId));
        return await target.ReadSchemaAsync(secret, cancellationToken);
    }
}
