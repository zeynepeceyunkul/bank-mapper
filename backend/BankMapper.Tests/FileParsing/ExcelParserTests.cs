using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Infrastructure.FileParsing;
using ClosedXML.Excel;
using Xunit;

namespace BankMapper.Tests.FileParsing;

public class ExcelParserTests
{
    private static Stream BuildWorkbookWithSampleRow()
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Sheet1");
        worksheet.Cell(1, 1).Value = "AdSoyad";
        worksheet.Cell(1, 2).Value = "TCKimlikNo";
        worksheet.Cell(2, 1).Value = "Mehmet Demir";
        worksheet.Cell(2, 2).Value = "11122233344";

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    [Fact]
    public void Detection_mode_reads_field_names_from_header_row()
    {
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Excel,
            FormatOptions = new SourceFormatOptions { HasHeader = true },
            Fields = [],
        };

        var result = new ExcelParser().Parse(BuildWorkbookWithSampleRow(), schema);

        Assert.Equal(["AdSoyad", "TCKimlikNo"], result.FieldNames);
        Assert.Empty(result.Rows);
    }

    [Fact]
    public void Full_read_mode_parses_data_rows_by_defined_fields()
    {
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Excel,
            FormatOptions = new SourceFormatOptions { HasHeader = true },
            Fields =
            [
                new SourceField { Name = "AdSoyad", Order = 1 },
                new SourceField { Name = "TCKimlikNo", Order = 2 },
            ],
        };

        var result = new ExcelParser().Parse(BuildWorkbookWithSampleRow(), schema);

        Assert.Single(result.Rows);
        Assert.Equal("Mehmet Demir", result.Rows[0]["AdSoyad"]);
        Assert.Equal("11122233344", result.Rows[0]["TCKimlikNo"]);
    }

    [Fact]
    public void Full_read_mode_matches_columns_by_header_text_even_if_file_column_order_differs()
    {
        // Dosyada TCKimlikNo, AdSoyad'dan once geliyor (sema tanimlanirkenki siradan
        // farkli) - eslesme header METNINE gore yapilmali, sema alan sirasina gore degil.
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Sheet1");
        worksheet.Cell(1, 1).Value = "TCKimlikNo";
        worksheet.Cell(1, 2).Value = "AdSoyad";
        worksheet.Cell(2, 1).Value = "11122233344";
        worksheet.Cell(2, 2).Value = "Mehmet Demir";
        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Excel,
            FormatOptions = new SourceFormatOptions { HasHeader = true },
            Fields =
            [
                new SourceField { Name = "AdSoyad", Order = 1 },
                new SourceField { Name = "TCKimlikNo", Order = 2 },
            ],
        };

        var result = new ExcelParser().Parse(stream, schema);

        Assert.Equal("Mehmet Demir", result.Rows[0]["AdSoyad"]);
        Assert.Equal("11122233344", result.Rows[0]["TCKimlikNo"]);
    }

    [Fact]
    public void Full_read_mode_throws_when_expected_column_missing_from_header()
    {
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Excel,
            FormatOptions = new SourceFormatOptions { HasHeader = true },
            Fields =
            [
                new SourceField { Name = "AdSoyad", Order = 1 },
                new SourceField { Name = "Iban", Order = 2 },
            ],
        };

        Assert.Throws<ArgumentException>(() => new ExcelParser().Parse(BuildWorkbookWithSampleRow(), schema));
    }

    [Fact]
    public void Full_read_mode_finds_a_column_that_comes_after_a_blank_header_cell()
    {
        // Ortadaki bos hucre (col2) hicbir zaman dokunulmadigi icin ClosedXML
        // onu "kullanilmis" saymiyor - CellsUsed().Count() ile kolon sayisi
        // hesaplanirsa 2 cikar (col1+col3), oysa gercek kullanilan aralik 3
        // kolon genisliginde ve TCKimlikNo (col3) o sayimin disinda kalirdi,
        // "Beklenen sütun bulunamadı" hatasina yol acardi.
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Sheet1");
        worksheet.Cell(1, 1).Value = "AdSoyad";
        worksheet.Cell(1, 3).Value = "TCKimlikNo";
        worksheet.Cell(2, 1).Value = "Mehmet Demir";
        worksheet.Cell(2, 3).Value = "11122233344";

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Excel,
            FormatOptions = new SourceFormatOptions { HasHeader = true },
            Fields =
            [
                new SourceField { Name = "AdSoyad", Order = 1 },
                new SourceField { Name = "TCKimlikNo", Order = 2 },
            ],
        };

        var result = new ExcelParser().Parse(stream, schema);

        Assert.Equal("Mehmet Demir", result.Rows[0]["AdSoyad"]);
        Assert.Equal("11122233344", result.Rows[0]["TCKimlikNo"]);
    }

    [Fact]
    public void Reads_only_the_first_worksheet_and_ignores_the_rest()
    {
        // Mentorun (Fatih Bey) 2026-08-10 onayi: birden fazla sayfa varsa
        // sadece ilki okunur, digerleri sessizce yok sayilir - hata verilmez.
        using var workbook = new XLWorkbook();
        var sheet1 = workbook.Worksheets.Add("Sheet1");
        sheet1.Cell(1, 1).Value = "AdSoyad";
        sheet1.Cell(2, 1).Value = "Mehmet Demir";
        var sheet2 = workbook.Worksheets.Add("Sheet2");
        sheet2.Cell(1, 1).Value = "AdSoyad";
        sheet2.Cell(2, 1).Value = "Bu Ikinci Sayfadan Gelmemeli";

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Excel,
            FormatOptions = new SourceFormatOptions { HasHeader = true },
            Fields = [new SourceField { Name = "AdSoyad", Order = 1 }],
        };

        var result = new ExcelParser().Parse(stream, schema);

        Assert.Single(result.Rows);
        Assert.Equal("Mehmet Demir", result.Rows[0]["AdSoyad"]);
    }
}
