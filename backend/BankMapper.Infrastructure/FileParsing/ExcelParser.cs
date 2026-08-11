using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;
using ClosedXML.Excel;

namespace BankMapper.Infrastructure.FileParsing;

public class ExcelParser : IFileParser
{
    public ParsedFileResult Parse(Stream fileStream, SourceSchema schema)
    {
        using var workbook = new XLWorkbook(fileStream);

        // Birden fazla sayfali Excel dosyalarinda sadece ilk sayfa okunur,
        // digerleri yok sayilir - mentorun (Fatih Bey) 2026-08-10 tarihli
        // acik onayi: "Excel'deki ilk sheeti alman yeterli, diger sheetleri
        // yok sayabiliriz." Onceden burada >1 sayfa varsa hata veren gecici
        // bir koruma vardi (karar netlesene kadar); artik kalici davranis bu.
        var worksheet = workbook.Worksheets.First();
        var usedRange = worksheet.RangeUsed();
        var rows = usedRange?.RowsUsed().ToList() ?? [];

        if (rows.Count == 0)
        {
            return new ParsedFileResult();
        }

        var isDetectionMode = schema.Fields.Count == 0;
        var hasHeader = schema.FormatOptions.HasHeader;
        var firstRow = rows[0];

        // CellsUsed().Count() sadece icerigi/formati olan hucreleri sayar - araya
        // bos birakilmis (orn. formati temizlenmis) bir baslik hucresi varsa
        // sessizce eksik sayar, bu da sonraki tum kolonlarin kaymasina yol acar.
        // Bunun yerine kullanilan araligin tam genisligini (bosluklar dahil) aliyoruz.
        var columnCount = usedRange!.ColumnCount();

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
