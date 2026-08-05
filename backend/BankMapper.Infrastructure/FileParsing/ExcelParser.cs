using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;
using ClosedXML.Excel;

namespace BankMapper.Infrastructure.FileParsing;

public class ExcelParser : IFileParser
{
    public ParsedFileResult Parse(Stream fileStream, SourceSchema schema)
    {
        using var workbook = new XLWorkbook(fileStream);

        // Birden fazla sayfali Excel dosyalarinin nasil ele alinacagina dair
        // karar henuz verilmedi (kullanicinin sayfa secmesi mi, hepsinin ayni
        // yapida olmasi mi, vb.) - o karar netlesene kadar sessizce ilk sayfayi
        // okuyup digerlerini yok saymak yerine acikca hata veriyoruz.
        if (workbook.Worksheets.Count > 1)
        {
            throw new ArgumentException(
                "Excel dosyasında birden fazla sayfa (worksheet) bulundu. Şu anda yalnızca tek sayfalı dosyalar destekleniyor.");
        }

        var worksheet = workbook.Worksheets.First();
        var rows = worksheet.RangeUsed()?.RowsUsed().ToList() ?? [];

        if (rows.Count == 0)
        {
            return new ParsedFileResult();
        }

        var isDetectionMode = schema.Fields.Count == 0;
        var hasHeader = schema.FormatOptions.HasHeader;
        var firstRow = rows[0];
        var columnCount = firstRow.CellsUsed().Count();

        var fieldNames = isDetectionMode
            ? (hasHeader
                ? firstRow.Cells(1, columnCount).Select(c => c.GetString()).ToList()
                : GenerateColumnNames(columnCount))
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
            ? ResolveColumnIndexes(fieldNames, firstRow.Cells(1, columnCount).Select(c => c.GetString()).ToList())
            : Enumerable.Range(0, fieldNames.Count).ToList();

        var dataRows = hasHeader ? rows.Skip(1) : rows;
        foreach (var row in dataRows)
        {
            var dict = new Dictionary<string, string?>();
            for (var i = 0; i < fieldNames.Count; i++)
            {
                dict[fieldNames[i]] = row.Cell(columnIndexes[i] + 1).GetString();
            }
            result.Rows.Add(dict);
        }

        return result;
    }

    private static List<string> GenerateColumnNames(int count) =>
        Enumerable.Range(1, count).Select(i => $"Column{i}").ToList();

    private static List<int> ResolveColumnIndexes(List<string> fieldNames, List<string> header)
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
}
