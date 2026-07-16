using System.Text;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Infrastructure.FileParsing;
using Xunit;

namespace BankMapper.Tests.FileParsing;

public class CsvParserTests
{
    private static Stream ToStream(string content) => new MemoryStream(Encoding.UTF8.GetBytes(content));

    [Fact]
    public void Detection_mode_with_header_reads_field_names_from_header_row()
    {
        const string csv = "Ad,Soyad,TC\nAhmet,Yilmaz,111\n";
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Csv,
            FormatOptions = new SourceFormatOptions { HasHeader = true, Delimiter = "," },
            Fields = [],
        };

        var result = new CsvParser().Parse(ToStream(csv), schema);

        Assert.Equal(["Ad", "Soyad", "TC"], result.FieldNames);
        Assert.Empty(result.Rows);
    }

    [Fact]
    public void Detection_mode_without_header_generates_column_names()
    {
        const string csv = "Ahmet,Yilmaz,111\n";
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Csv,
            FormatOptions = new SourceFormatOptions { HasHeader = false, Delimiter = "," },
            Fields = [],
        };

        var result = new CsvParser().Parse(ToStream(csv), schema);

        Assert.Equal(["Column1", "Column2", "Column3"], result.FieldNames);
    }

    [Fact]
    public void Full_read_mode_parses_all_data_rows_by_defined_fields()
    {
        const string csv = "Ad,Soyad,TC\nAhmet,Yilmaz,111\nAyse,Kaya,222\n";
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Csv,
            FormatOptions = new SourceFormatOptions { HasHeader = true, Delimiter = "," },
            Fields =
            [
                new SourceField { Name = "Ad", Order = 1 },
                new SourceField { Name = "Soyad", Order = 2 },
                new SourceField { Name = "TC", Order = 3 },
            ],
        };

        var result = new CsvParser().Parse(ToStream(csv), schema);

        Assert.Equal(2, result.Rows.Count);
        Assert.Equal("Ahmet", result.Rows[0]["Ad"]);
        Assert.Equal("111", result.Rows[0]["TC"]);
        Assert.Equal("Ayse", result.Rows[1]["Ad"]);
    }
}
