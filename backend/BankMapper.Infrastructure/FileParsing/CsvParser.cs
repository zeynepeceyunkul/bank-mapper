using System.Globalization;
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

        using var reader = new StreamReader(fileStream);
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

        if (!hasHeader)
        {
            result.Rows.Add(ReadRow(csv, fieldNames));
        }

        while (csv.Read())
        {
            result.Rows.Add(ReadRow(csv, fieldNames));
        }

        return result;
    }

    private static List<string> GenerateColumnNames(int count) =>
        Enumerable.Range(1, count).Select(i => $"Column{i}").ToList();

    private static Dictionary<string, string?> ReadRow(CsvReader csv, List<string> fieldNames)
    {
        var row = new Dictionary<string, string?>();
        for (var i = 0; i < fieldNames.Count; i++)
        {
            row[fieldNames[i]] = csv.TryGetField<string>(i, out var value) ? value : null;
        }
        return row;
    }
}
