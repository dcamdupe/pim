namespace Pim.Api.Data;

public sealed class MongoSettings
{
    public required string ConnectionString { get; set; }

    public required string DatabaseName { get; set; }
}
