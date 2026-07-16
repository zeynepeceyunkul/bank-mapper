using System.Text;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Infrastructure.FileParsing;
using Xunit;

namespace BankMapper.Tests.FileParsing;

public class FixedLengthParserTests
{
    private static Stream ToStream(string content) => new MemoryStream(Encoding.UTF8.GetBytes(content));

    [Fact]
    public void Detection_mode_returns_raw_lines_when_fields_are_undefined()
    {
        const string content = "12345678901Ahmet Yilmaz\n";
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.FixedLength,
            FormatOptions = new SourceFormatOptions { HasHeader = false },
            Fields = [],
        };

        var result = new FixedLengthParser().Parse(ToStream(content), schema);

        Assert.Equal(["RawLine"], result.FieldNames);
        Assert.Single(result.Rows);
        Assert.Equal("12345678901Ahmet Yilmaz", result.Rows[0]["RawLine"]);
    }

    [Fact]
    public void Full_read_mode_extracts_fields_by_position()
    {
        const string content = "12345678901Ahmet Yilmaz \n";
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.FixedLength,
            FormatOptions = new SourceFormatOptions { HasHeader = false },
            Fields =
            [
                new SourceField { Name = "TC", Order = 1, StartIndex = 0, Length = 11 },
                new SourceField { Name = "AdSoyad", Order = 2, StartIndex = 11, Length = 13 },
            ],
        };

        var result = new FixedLengthParser().Parse(ToStream(content), schema);

        Assert.Single(result.Rows);
        Assert.Equal("12345678901", result.Rows[0]["TC"]);
        Assert.Equal("Ahmet Yilmaz ", result.Rows[0]["AdSoyad"]);
    }
}
