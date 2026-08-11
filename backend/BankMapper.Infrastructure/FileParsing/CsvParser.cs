using System.Globalization;
using System.Text;
using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;
using CsvHelper;
using CsvHelper.Configuration;

namespace BankMapper.Infrastructure.FileParsing;

public class CsvParser : IFileParser
{
    public ParsedFileResult Parse(Stream fileStream, SourceSchema schema)
    {
        var delimiter = string.IsNullOrWhiteSpace(schema.FormatOptions.Delimiter) ? "," : schema.FormatOptions.Delimiter;
        var hasHeader = schema.FormatOptions.HasHeader;
        var isDetectionMode = schema.Fields.Count == 0;

        // StreamReader varsayilan olarak gecersiz byte dizilerini sessizce "?"
        // ile degistirir, hata vermez - gercek bir ikili dosya (PDF, xlsx vb.)
        // CSV olarak yuklenirse "basariyla" ama anlamsiz baslik/alan adlari
        // uretirdi (canli test edildi: bir PDF'in ilk satirini header sandi).
        // Kesin UTF-8 dogrulamasi acarak en azindan gercek ikili/bozuk
        // dosyalari yakaliyoruz - gecerli-UTF8-ama-yanlis-formatli bir metin
        // dosyasini (orn. gercekten CSV olmayan duz metin) hala yakalamaz,
        // CSV formatinin kendi dogasindan gelen bir sinirlama.
        using var reader = new StreamReader(fileStream, new UTF8Encoding(false, true));
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = delimiter,
            HasHeaderRecord = hasHeader,
        });

        if (!csv.Read())
        {
            return new ParsedFileResult();
        }

        if (hasHeader)
        {
            csv.ReadHeader();
        }

        var fieldNames = isDetectionMode
            ? (hasHeader ? csv.HeaderRecord?.ToList() ?? [] : GenerateColumnNames(csv.Parser!.Count))
            : schema.Fields.OrderBy(f => f.Order).Select(f => f.Name).ToList();

        var result = new ParsedFileResult { FieldNames = fieldNames };

        if (isDetectionMode)
        {
            return result;
        }

        // Sema alanlari ile dosyadaki gercek kolonlari, sirasina degil
        // header METNINE gore eslestiriyoruz - kaynak dosyada kolon sirasi
        // degisirse (orn. IBAN ve Tutar yer degistirirse) yanlis alana
        // sessizce yanlis veri yazilmasini onlemek icin.
        var columnIndexes = hasHeader
            ? ResolveColumnIndexes(fieldNames, csv.HeaderRecord ?? [])
            : Enumerable.Range(0, fieldNames.Count).ToList();

        if (!hasHeader)
        {
            result.Rows.Add(ReadRow(csv, fieldNames, columnIndexes));
        }

        while (csv.Read())
        {
            result.Rows.Add(ReadRow(csv, fieldNames, columnIndexes));
        }

        return result;
    }

    private static List<string> GenerateColumnNames(int count) =>
        Enumerable.Range(1, count).Select(i => $"Column{i}").ToList();

    private static List<int> ResolveColumnIndexes(List<string> fieldNames, string[] header)
    {
        var normalizedHeader = header.Select(h => h.Trim().ToLowerInvariant()).ToList();
        var columnIndexes = new List<int>();

        foreach (var name in fieldNames)
        {
            var index = normalizedHeader.IndexOf(name.Trim().ToLowerInvariant());
            if (index < 0)
            {
                throw new ArgumentException($"Beklenen sütun bulunamadı: {name}");
            }
            columnIndexes.Add(index);
        }

        return columnIndexes;
    }

    private static Dictionary<string, string?> ReadRow(CsvReader csv, List<string> fieldNames, List<int> columnIndexes)
    {
        var row = new Dictionary<string, string?>();
        for (var i = 0; i < fieldNames.Count; i++)
        {
            row[fieldNames[i]] = csv.TryGetField<string>(columnIndexes[i], out var value) ? value : null;
        }
        return row;
    }
}
