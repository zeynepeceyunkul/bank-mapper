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

    [Fact]
    public void Full_read_mode_matches_columns_by_header_text_even_if_file_column_order_differs()
    {
        // Dosyada TC ve Soyad yer degistirmis (sema tanimlanirkenki siradan farkli) -
        // eslesme header METNINE gore yapilmali, sema alan sirasina gore degil.
        const string csv = "Ad,TC,Soyad\nAhmet,111,Yilmaz\n";
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

        Assert.Equal("Ahmet", result.Rows[0]["Ad"]);
        Assert.Equal("Yilmaz", result.Rows[0]["Soyad"]);
        Assert.Equal("111", result.Rows[0]["TC"]);
    }

    [Fact]
    public void Full_read_mode_throws_when_expected_column_missing_from_header()
    {
        const string csv = "Ad,Soyad\nAhmet,Yilmaz\n";
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

        Assert.Throws<ArgumentException>(() => new CsvParser().Parse(ToStream(csv), schema));
    }

    [Fact]
    public void Throws_on_genuinely_invalid_binary_content_instead_of_silently_producing_garbage_fields()
    {
        // Once StreamReader varsayilan (gevsek) kod cozme kullaniyordu -
        // gecersiz byte dizilerini sessizce "?" ile degistirip devam ediyordu,
        // boylece bir PDF/xlsx yanlislikla CSV olarak yuklenirse hata vermeden
        // anlamsiz "basarili" alan adlari uretiliyordu (canli dogrulandi).
        // "%PDF" + gecersiz UTF-8 devam baytlari (0x80 tek basina gecersiz).
        var invalidUtf8 = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x80, 0x80, 0x80, 0x0A };
        var schema = new SourceSchema
        {
            FileFormat = FileFormat.Csv,
            FormatOptions = new SourceFormatOptions { HasHeader = true, Delimiter = "," },
            Fields = [],
        };

        Assert.Throws<DecoderFallbackException>(() => new CsvParser().Parse(new MemoryStream(invalidUtf8), schema));
    }
}
