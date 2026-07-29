using System.Text.Json.Serialization;
using Pim.Api.Repository;

namespace Pim.Api.Data;

public sealed class TransactionMonth
{
    public required string Email { get; set; }

    public required int Year { get; set; }

    public required int Month { get; set; }

    public List<Transaction> Transactions { get; set; } = [];

    [Id]
    [JsonIgnore]
    public string Id => BuildId(Email, Year, Month);

    public static string BuildId(string email, int year, int month) => $"{email}|{year:D4}-{month:D2}";
}
