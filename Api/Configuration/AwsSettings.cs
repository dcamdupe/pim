namespace Pim.Api.Configuration;

public sealed class AwsSettings
{
    public required string Region { get; set; }

    // Set locally to point at DynamoDB Local instead of real AWS; absent in Production.
    public string? ServiceUrl { get; set; }
}
