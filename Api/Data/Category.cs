namespace Pim.Api.Data;

public sealed class Category
{
    public required string Name { get; set; }

    public required string Colour { get; set; }

    public required CategoryType Type { get; set; }

    public enum CategoryType
    {
        Income,
        Expense,
        Inactive,
    }

    // Denormalizes this category's Type onto a transaction whenever its Category is set or changed
    // - callers only invoke this on an actual category change, not every save, so it doesn't fight
    // the independent manual "Set active/Set inactive" toggle on Transaction.Inactive. A Type of
    // Inactive additionally sets Transaction.Inactive, giving it the same dashboard/listing effect
    // the old standalone Category.Inactive flag had.
    public static void StampTransaction(Transaction transaction, IEnumerable<Category> categories)
    {
        var category = categories.FirstOrDefault(c => c.Name == transaction.Category);
        transaction.Type = category?.Type;
        transaction.Inactive = category is null ? null : category.Type == CategoryType.Inactive;
    }
}
