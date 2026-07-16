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
}
