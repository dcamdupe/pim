namespace Pim.Api.Data;

public sealed class Category
{
    public required string Name { get; set; }

    public required string Colour { get; set; }

    public bool Inactive { get; set; }

    public required CategoryType Type { get; set; }

    public enum CategoryType
    {
        Income,
        Expense,
    }

    // Denormalizes this category's Type/Inactive onto a transaction whenever its Category is set or
    // changed - callers only invoke this on an actual category change, not every save, so it doesn't
    // fight the independent manual "Set active/Set inactive" toggle on Transaction.Inactive.
    public static void StampTransaction(Transaction transaction, IEnumerable<Category> categories)
    {
        var category = categories.FirstOrDefault(c => c.Name == transaction.Category);
        transaction.Type = category?.Type;
        transaction.Inactive = category?.Inactive;
    }
}
