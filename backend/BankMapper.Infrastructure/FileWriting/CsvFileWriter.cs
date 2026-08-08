using System.Globalization;
using System.Text;
using BankMapper.Application.FileWriting;
using CsvHelper;
using CsvHelper.Configuration;

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

        using var stream = new MemoryStream();
        // BOM'suz UTF8: Encoding.UTF8.GetBytes de BOM eklemiyordu, StreamWriter'in
        // parametresiz varsayilani BOM ekler - onceki davranisla ayni kalmasi icin
        // acikca belirtiliyor.
        using (var streamWriter = new StreamWriter(stream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false), leaveOpen: true))
        using (var csv = new CsvWriter(streamWriter, new CsvConfiguration(CultureInfo.InvariantCulture)))
        {
            foreach (var column in columns)
            {
                csv.WriteField(column);
            }
            csv.NextRecord();

            foreach (var row in rows)
            {
                foreach (var column in columns)
                {
                    csv.WriteField(row.GetValueOrDefault(column)?.ToString() ?? string.Empty);
                }
                csv.NextRecord();
            }
        }

        return stream.ToArray();
    }
}
