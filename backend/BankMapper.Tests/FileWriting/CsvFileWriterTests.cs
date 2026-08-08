using System.Text;
using BankMapper.Infrastructure.FileWriting;
using Xunit;

namespace BankMapper.Tests.FileWriting;

public class CsvFileWriterTests
{
    private static string WriteAsText(List<Dictionary<string, object?>> rows) =>
        Encoding.UTF8.GetString(new CsvFileWriter().Write(rows));

    [Fact]
    public void Empty_rows_produce_empty_output()
    {
        var result = new CsvFileWriter().Write([]);

        Assert.Empty(result);
    }

    [Fact]
    public void Writes_header_and_rows_in_column_order()
    {
        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["Ad"] = "Ahmet", ["Soyad"] = "Yilmaz" },
            new() { ["Ad"] = "Ayse", ["Soyad"] = "Kaya" },
        };

        var text = WriteAsText(rows);

        Assert.Equal("Ad,Soyad\r\nAhmet,Yilmaz\r\nAyse,Kaya\r\n", text);
    }

    [Fact]
    public void Missing_value_for_a_column_is_written_as_empty()
    {
        var rows = new List<Dictionary<string, object?>> { new() { ["Ad"] = "Ahmet" } };

        var text = WriteAsText(rows);

        Assert.Equal("Ad\r\nAhmet\r\n", text);
    }

    [Fact]
    public void Values_containing_comma_quote_or_newline_are_quoted_and_escaped()
    {
        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["Aciklama"] = "Istanbul, Turkiye" },
            new() { ["Aciklama"] = "\"Onemli\" not" },
            new() { ["Aciklama"] = "Satir1\nSatir2" },
        };

        var text = WriteAsText(rows);

        Assert.Equal(
            "Aciklama\r\n\"Istanbul, Turkiye\"\r\n\"\"\"Onemli\"\" not\"\r\n\"Satir1\nSatir2\"\r\n",
            text);
    }

    [Fact]
    public void Output_has_no_byte_order_mark()
    {
        var bytes = new CsvFileWriter().Write([new Dictionary<string, object?> { ["Ad"] = "Ahmet" }]);

        Assert.NotEqual(0xEF, bytes[0]);
    }
}
