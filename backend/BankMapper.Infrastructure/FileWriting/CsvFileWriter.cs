using System.Text;
using BankMapper.Application.FileWriting;

namespace BankMapper.Infrastructure.FileWriting;

public class CsvFileWriter : IFileWriter
{
    public string ContentType => "text/csv";

    public string FileExtension => "csv";

    public byte[] Write(List<Dictionary<string, object?>> rows)
    {
        if (rows.Count == 0)
        {
            return [];
        }

        var columns = rows[0].Keys.ToList();
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(",", columns.Select(EscapeCsvValue)));

        foreach (var row in rows)
        {
            var values = columns.Select(c => EscapeCsvValue(row.GetValueOrDefault(c)?.ToString() ?? string.Empty));
            builder.AppendLine(string.Join(",", values));
        }

        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private static string EscapeCsvValue(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
}
