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

    [Fact]
    public void Throws_on_genuinely_invalid_binary_content()
    {
        // "%PDF" + gecersiz UTF-8 devam baytlari (0x80 tek basina gecersiz) -
        // bkz. CsvParserTests'teki ayni testin gerekcesi. FixedLengthParser'in
        // konum-bazli okumasi zaten icerik dogrulamasi yapmiyor (bilinen,
        // henuz kapatilamamis boyle bir boslu var), ama en azindan gercek
        // ikili dosyalari StreamReader seviyesinde reddediyor artik.
        var invalidUtf8 = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x80, 0x80, 0x80, 0x0A };
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.FixedLength,
            FormatOptions = new SourceFormatOptions { HasHeader = false },
            Fields = [new SourceField { Name = "A", Order = 1, StartIndex = 0, Length = 3 }],
        };

        Assert.Throws<DecoderFallbackException>(() => new FixedLengthParser().Parse(new MemoryStream(invalidUtf8), schema));
    }
}
