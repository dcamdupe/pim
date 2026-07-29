using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using Pim.Api.Services.CSVParsers;

namespace Pim.Api.UnitTests.Services.CSVParsers;

// Fixture format matches a real TM Bank export: Date, <blank>, Description, <blank>, Amount,
// running Balance - 6 columns, not the 5 originally assumed. Description is quoted since real
// exports do (and may contain commas); Balance (last column) is never read.
public class TmBankCsvParserTests
{
    private const string Account = "Everyday";

    [Fact]
    public void Parse_ReturnsTransactions_WithEmptyCategory_IgnoringHeaderRowAndBalanceColumn()
    {
        var csv = "131150S1,,,,,\n" +
            "01 JUN 2026,,\"DIRECT CREDIT From: ATO Ref: ATO009000022895469\",,108.72,1038.18\n" +
            "01 JUN 2026,,\"DIRECT DEBIT From: TEACHERS HEALTH Ref: 43005\",,-400.61,637.57\n";
        var sut = CreateParser(csv);

        var transactions = sut.Parse(Account);

        Assert.Equal(2, transactions.Count);
        Assert.All(transactions, t => Assert.Equal(Account, t.Account));
        Assert.All(transactions, t => Assert.Equal(string.Empty, t.Category));
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 6, 1) &&
            t.Description == "DIRECT CREDIT From: ATO Ref: ATO009000022895469" &&
            t.Amount == 108.72m);
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 6, 1) &&
            t.Description == "DIRECT DEBIT From: TEACHERS HEALTH Ref: 43005" &&
            t.Amount == -400.61m);
    }

    [Fact]
    public void Parse_HandlesQuotedDescriptionsContainingCommas()
    {
        var csv = "131150S1,,,,,\n" +
            "12 JUN 2026,,\"MONEYTECH PAYROLL, From: SERVICES Ref: PAYROLL 30062026\",,13861.33,14361.33\n";
        var sut = CreateParser(csv);

        var transactions = sut.Parse(Account);

        var transaction = Assert.Single(transactions);
        Assert.Equal("MONEYTECH PAYROLL, From: SERVICES Ref: PAYROLL 30062026", transaction.Description);
        Assert.Equal(13861.33m, transaction.Amount);
    }

    [Fact]
    public void Parse_SkipsBlankTrailingLines()
    {
        var csv = "131150S1,,,,,\n" +
            "01 JUN 2026,,\"DIRECT CREDIT From: ATO Ref: ATO009000022895469\",,108.72,1038.18\n\n";
        var sut = CreateParser(csv);

        var transactions = sut.Parse(Account);

        Assert.Single(transactions);
    }

    [Fact]
    public void Parse_Throws_WhenDateCannotBeParsed()
    {
        var csv = "131150S1,,,,,\n" +
            "not-a-date,,\"Coffee\",,-4.50,637.57\n";
        var sut = CreateParser(csv);

        Assert.Throws<FormatException>(() => sut.Parse(Account));
    }

    [Fact]
    public void Parse_Throws_WhenAmountCannotBeParsed()
    {
        var csv = "131150S1,,,,,\n" +
            "01 JUN 2026,,\"Coffee\",,not-a-number,637.57\n";
        var sut = CreateParser(csv);

        Assert.Throws<FormatException>(() => sut.Parse(Account));
    }

    [Fact]
    public void Parse_HandlesARealFullExport()
    {
        var sut = CreateParser(RealExportSample);

        var transactions = sut.Parse(Account);

        Assert.Equal(31, transactions.Count);
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 6, 1) &&
            t.Description == "DIRECT CREDIT From: ATO Ref: ATO009000022895469" &&
            t.Amount == 108.72m);
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 6, 12) &&
            t.Description == "MONEYTECH PAYROLL      From: SERVICES Ref: PAYROLL 30062026" &&
            t.Amount == 13861.33m);
        Assert.Contains(transactions, t =>
            t.Date == new DateOnly(2026, 7, 13) &&
            t.Description == "TFR TO 182182 004786182 ONLINE To-Victoria & David Cameron Ref-transfer" &&
            t.Amount == -13471.72m);
    }

    private static TmBankCsvParser CreateParser(string content)
    {
        var reader = new StreamReader(new MemoryStream(Encoding.UTF8.GetBytes(content)));
        var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false });
        return new TmBankCsvParser(csv);
    }

    private const string RealExportSample =
        """
        131150S1,,,,,
        01 JUN 2026,,"DIRECT CREDIT From: ATO Ref: ATO009000022895469",,108.72,1038.18
        01 JUN 2026,,"DIRECT DEBIT From: TEACHERS HEALTH Ref: 43005",,-400.61,637.57
        01 JUN 2026,,"DIRECT CREDIT From: MCARE BENEFITS Ref: 727004448 AYHB",,29.55,667.12
        03 JUN 2026,,"TFR to Joel Tjoa MOB 062948 20008450 Ref-Hugh D&D at Jude's",,-25.00,642.12
        08 JUN 2026,,"TFR MOB From-H T CAMERON Ref-Geometry dash",,7.50,649.62
        10 JUN 2026,,"DIRECT CREDIT From: ALL SAINTS ANGLI Ref: Officeworks",,451.00,1100.62
        10 JUN 2026,,"TFR to Victoria & David Cameron ONLINE 182182 004786182 Ref-transfer",,-600.62,500.00
        12 JUN 2026,,"MONEYTECH PAYROLL      From: SERVICES Ref: PAYROLL 30062026",,13861.33,14361.33
        13 JUN 2026,,"TFR TO 182182 004786182 ONLINE To-Victoria & David Cameron Ref-transfer",,-12000.00,2361.33
        13 JUN 2026,,"TFR to Victoria & David Cameron ONLINE 182182 004786182 Ref-transfer",,-1861.33,500.00
        15 JUN 2026,,"DIRECT CREDIT From: ALL SAINTS ANGLI Ref: WAC wages",,2073.72,2573.72
        15 JUN 2026,,"PAYPAL AUSTRALIA       From: PAYPAL AUSTRALIA Ref: 1050987733743",,14.00,2587.72
        15 JUN 2026,,"TFR MOB To-O W CAMERON",,-40.00,2547.72
        15 JUN 2026,,"TFR to Victoria & David Cameron ONLINE 182182 004786182 Ref-transfer",,-2047.72,500.00
        18 JUN 2026,,"TFR From ROGER HOWARD Ref-Phone",,304.40,804.40
        20 JUN 2026,,"TFR to Victoria & David Cameron MOB 182182 004786182 Ref-Transfer",,-304.40,500.00
        28 JUN 2026,,"TFR MOB To-O W CAMERON",,-10.00,490.00
        01 JUL 2026,,"DIRECT DEBIT From: TEACHERS HEALTH Ref: 43005",,-400.61,89.39
        13 JUL 2026,,"MONEYTECH PAYROLL      From: SERVICES Ref: PAYROLL 31072026",,13882.33,13971.72
        13 JUL 2026,,"TFR TO 182182 004786182 ONLINE To-Victoria & David Cameron Ref-transfer",,-13471.72,500.00
        13 JUL 2026,,"DIRECT CREDIT From: ALL SAINTS ANGLI Ref: WAC Expenses",,50.00,550.00
        13 JUL 2026,,"DIRECT CREDIT From: ALL SAINTS ANGLI Ref: WAC expenses",,95.89,645.89
        15 JUL 2026,,"DIRECT CREDIT From: ALL SAINTS ANGLI Ref: WAC wages",,2073.72,2719.61
        16 JUL 2026,,"TFR to Victoria & David Cameron MOB 182182 004786182 Ref-Transfer",,-2119.61,600.00
        17 JUL 2026,,"TFR to Sanyukta Murray MOB 732188 632635 Ref-Elias escape room",,-70.00,530.00
        21 JUL 2026,,"DIRECT CREDIT From: MCARE BENEFITS Ref: 763000286 AYWP",,133.00,663.00
        21 JUL 2026,,"APO DEP Chq MOUNT-11:56",,1000.00,1663.00
        21 JUL 2026,,"DIRECT CREDIT From: ALL SAINTS ANGLI Ref: WAC expenses",,31.98,1694.98
        21 JUL 2026,,"DIRECT CREDIT From: MCARE BENEFITS Ref: 374173051 AYWQ",,44.45,1739.43
        28 JUL 2026,,"APO DEP Chq MOUNT-17:19",,1000.00,2739.43
        28 JUL 2026,,"DIRECT CREDIT From: MCARE BENEFITS Ref: 379132502 AYWQ",,45.05,2784.48
        """;
}
