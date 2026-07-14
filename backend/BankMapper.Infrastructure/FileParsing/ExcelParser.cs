using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;
using ClosedXML.Excel;

namespace BankMapper.Infrastructure.FileParsing;

public class ExcelParser : IFileParser
{
    public ParsedFileResult Parse(Stream fileStream, SourceSchema schema)
    {
        using var workbook = new XLWorkbook(fileStream);
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

        var dataRows = hasHeader ? rows.Skip(1) : rows;
        foreach (var row in dataRows)
        {
            var dict = new Dictionary<string, string?>();
            for (var i = 0; i < fieldNames.Count; i++)
            {
                dict[fieldNames[i]] = row.Cell(i + 1).GetString();
            }
            result.Rows.Add(dict);
        }

        return result;
    }

    private static List<string> GenerateColumnNames(int count) =>
        Enumerable.Range(1, count).Select(i => $"Column{i}").ToList();
}
