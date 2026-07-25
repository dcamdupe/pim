using MongoDB.Bson.Serialization.Attributes;

namespace Pim.Api.Data;

public sealed class User
{
    [BsonId]
    public required string Login { get; set; }

    public required string PasswordHash { get; set; }
}
