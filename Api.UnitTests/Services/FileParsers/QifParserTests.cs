using System.Text;
using Pim.Api.Services.FileParsers;

namespace Pim.Api.UnitTests.Services.FileParsers;

// Fixture shapes are drawn from four real example exports: TMBank.qif, amex.qif,
// Macquarie Offset.qif, Westpac Card.qif.
public class QifParserTests
{
    private const string Account = "Everyday";

    [Fact]
    public void Parse_UsesMemo_WhenNoPayeeField_TMBankStyle()
    {
        var qif =
            "!Type:Bank\n" +
            "D01/07/25\n" +
            "MDIRECT CREDIT From: ROGER HOWARD Ref: Shopping for Dad\n" +
            "T25.40\n" +
            "^\n";
        var sut = CreateParser(qif);

        var transactions = sut.Parse(Account);

        var transaction = Assert.Single(transactions);
        Assert.Equal(Account, transaction.Account);
        Assert.Equal(new DateOnly(2025, 7, 1), transaction.Date);
        Assert.Equal("DIRECT CREDIT From: ROGER HOWARD Ref: Shopping for Dad", transaction.Description);
        Assert.Equal(25.40m, transaction.Amount);
        Assert.Equal(string.Empty, transaction.Category);
    }

    [Fact]
    public void Parse_UsesPayee_WhenNumberFieldIsBlank_MacquarieStyle()
    {
        var qif =
            "!Type:Bank\n" +
            "D29/06/26\n" +
            "PTo Edwina Howard - Lunch Receipt number: ON0000213707403\n" +
            "N\n" +
            "T-140\n" +
            "^\n";
        var sut = CreateParser(qif);

        var transaction = Assert.Single(sut.Parse(Account));

        Assert.Equal(new DateOnly(2026, 6, 29), transaction.Date);
        Assert.Equal("To Edwina Howard - Lunch Receipt number: ON0000213707403", transaction.Description);
        Assert.Equal(-140m, transaction.Amount);
    }

    [Fact]
    public void Parse_PrefersPayeeOverMemo_AndTreatsBlankLinesAsRecordSeparators_AmexStyle()
    {
        var qif =
            "!Type:CCard\n" +
            "D30/06/2026\n" +
            "N20260630\n" +
            "T-14.99\n" +
            "PAPPLE.COM/BILL          SYDNEY\n" +
            "M\n" +
            "^\n" +
            "\n" +
            "D16/06/2026\n" +
            "N20260616\n" +
            "T-123.30\n" +
            "PPROGRESS SOFTWARE\n" +
            "MForeign Spend Amount: 84.00 UNITED STATES DOLLAR\n" +
            "^\n";
        var sut = CreateParser(qif);

        var transactions = sut.Parse(Account);

        Assert.Equal(2, transactions.Count);
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 6, 30) &&
            t.Description == "APPLE.COM/BILL          SYDNEY" &&
            t.Amount == -14.99m);
        // Payee wins even when Memo also has content on the same record.
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 6, 16) &&
            t.Description == "PROGRESS SOFTWARE" &&
            t.Amount == -123.30m);
    }

    [Fact]
    public void Parse_UsesMemo_AndIgnoresClassLabel_WestpacStyle()
    {
        var qif =
            "!Type:Bank\n" +
            "D25/06/2026\n" +
            "MHotel at Booking.com Sydney AU\n" +
            "T-226.33\n" +
            "LOTHER\n" +
            "^\n";
        var sut = CreateParser(qif);

        var transaction = Assert.Single(sut.Parse(Account));

        Assert.Equal(new DateOnly(2026, 6, 25), transaction.Date);
        Assert.Equal("Hotel at Booking.com Sydney AU", transaction.Description);
        Assert.Equal(-226.33m, transaction.Amount);
    }

    [Fact]
    public void Parse_ReturnsAllRecords_WhenFileHasMultipleTransactions()
    {
        var qif =
            "!Type:Bank\n" +
            "D01/07/25\n" +
            "MFirst\n" +
            "T10.00\n" +
            "^\n" +
            "D02/07/25\n" +
            "MSecond\n" +
            "T-5.00\n" +
            "^\n";
        var sut = CreateParser(qif);

        var transactions = sut.Parse(Account);

        Assert.Equal(2, transactions.Count);
        Assert.Contains(transactions, t => t.Description == "First" && t.Amount == 10.00m);
        Assert.Contains(transactions, t => t.Description == "Second" && t.Amount == -5.00m);
    }

    private static QifParser CreateParser(string content) =>
        new(new MemoryStream(Encoding.UTF8.GetBytes(content)));
}
