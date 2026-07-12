using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;

namespace BankMapper.Infrastructure.FileParsing;

public class FixedLengthParser : IFileParser
{
    public ParsedFileResult Parse(Stream fileStream, SourceSchema schema)
    {
        using var reader = new StreamReader(fileStream);

        if (schema.Fields.Count == 0)
        {
            return ReadRawLines(reader);
        }

        var orderedFields = schema.Fields.OrderBy(f => f.Order).ToList();
        var result = new ParsedFileResult { FieldNames = orderedFields.Select(f => f.Name).ToList() };

        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            var row = new Dictionary<string, string?>();
            foreach (var field in orderedFields)
            {
                var start = field.StartIndex ?? 0;
                var length = field.Length ?? 0;
                row[field.Name] = start < line.Length
                    ? line.Substring(start, Math.Min(length, line.Length - start))
                    : null;
            }
            result.Rows.Add(row);
        }

        return result;
    }

    private static ParsedFileResult ReadRawLines(StreamReader reader)
    {
        var result = new ParsedFileResult { FieldNames = ["RawLine"] };

        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            result.Rows.Add(new Dictionary<string, string?> { ["RawLine"] = line });
        }

        return result;
    }
}
