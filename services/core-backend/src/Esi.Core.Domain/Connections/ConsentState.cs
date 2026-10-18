namespace Esi.Core.Domain.Connections;

/// <summary>Per-connection consent. Withdrawn disables every feature for the database and hides its data.</summary>
public enum ConsentState
{
    Granted = 0,
    Withdrawn = 1,
}
