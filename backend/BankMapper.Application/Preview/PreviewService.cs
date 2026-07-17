using System.Text;
using BankMapper.Application.Abstractions;
using BankMapper.Application.FileParsing;
using BankMapper.Domain.Execution;

namespace BankMapper.Application.Preview;

public class PreviewService(
    IMappingRepository mappingRepository,
    ISourceSchemaRepository sourceSchemaRepository,
    IFileParserFactory fileParserFactory,
    MappingExecutor mappingExecutor) : IPreviewService
{
    private const int MaxPreviewRows = 50;

    public async Task<List<Dictionary<string, object?>>> ExecuteAsync(string mappingId, Stream file)
    {
        var rows = await RunMappingAsync(mappingId, file);
        return rows.Take(MaxPreviewRows).ToList();
    }

    public async Task<string> ConvertToCsvAsync(string mappingId, Stream file)
    {
        var rows = await RunMappingAsync(mappingId, file);
        return BuildCsv(rows);
    }

    private async Task<List<Dictionary<string, object?>>> RunMappingAsync(string mappingId, Stream file)
    {
        var mapping = await mappingRepository.GetByIdAsync(mappingId)
            ?? throw new ArgumentException($"Mapping bulunamadi: {mappingId}");

        // Faz 9: mapping her zaman tam olarak 1 source semaya sahip; coklu kaynak
        // birlestirme (join-key ile) Faz 11'de gelecek.
        var mappingSourceSchema = mapping.SourceSchemas.First();
        var sourceSchema = await sourceSchemaRepository.GetByIdAsync(mappingSourceSchema.SourceSchemaId)
            ?? throw new ArgumentException($"Source sema bulunamadi: {mappingSourceSchema.SourceSchemaId}");

        var parser = fileParserFactory.GetParser(sourceSchema.FileFormat);
        var parsed = parser.Parse(file, sourceSchema);

        var namespacedRows = parsed.Rows.Select(row => row.ToDictionary(
            kvp => SourceFieldKey.Build(mappingSourceSchema.SourceSchemaId, kvp.Key),
            kvp => kvp.Value));

        return namespacedRows.Select(row => mappingExecutor.Apply(mapping, row)).ToList();
    }

    private static string BuildCsv(List<Dictionary<string, object?>> rows)
    {
        if (rows.Count == 0)
        {
            return string.Empty;
        }

        var columns = rows[0].Keys.ToList();
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(",", columns.Select(EscapeCsvValue)));

        foreach (var row in rows)
        {
            var values = columns.Select(c => EscapeCsvValue(row.GetValueOrDefault(c)?.ToString() ?? string.Empty));
            builder.AppendLine(string.Join(",", values));
        }

        return builder.ToString();
    }

    private static string EscapeCsvValue(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
}
