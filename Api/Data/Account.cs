using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Pim.Api.Data;

public sealed class Account
{
    public required string Name { get; set; }

    public required string Number { get; set; }

    [BsonRepresentation(BsonType.String)]
    public required AccountType Type { get; set; }

    public enum AccountType
    {
        Credit,
        Transaction,
        Savings,
    }
}
