using BankMapper.Application.Abstractions;
using BankMapper.Application.FileParsing;
using BankMapper.Application.FileWriting;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;
using Microsoft.Extensions.Logging;

namespace BankMapper.Application.Preview;

public class PreviewService(
    IMappingRepository mappingRepository,
    ISourceSchemaRepository sourceSchemaRepository,
    IFileParserFactory fileParserFactory,
    MappingExecutor mappingExecutor,
    IFileWriterFactory fileWriterFactory,
    ILogger<PreviewService> logger) : IPreviewService
{
    private const int MaxPreviewRows = 50;

    public async Task<PreviewExecuteResult> ExecuteAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files)
    {
        var (rows, warnings) = await RunMappingAsync(mappingId, files);
        logger.LogInformation(
            "Onizleme calistirildi: mapping {MappingId}, {FileCount} dosya, {RowCount} satir uretildi",
            mappingId, files.Count, rows.Count);
        return new PreviewExecuteResult { Rows = rows.Take(MaxPreviewRows).ToList(), Warnings = warnings };
    }

    public async Task<ConvertResult> ConvertAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files, FileFormat format)
    {
        var (rows, _) = await RunMappingAsync(mappingId, files);
        logger.LogInformation(
            "Donusturme calistirildi: mapping {MappingId}, {FileCount} dosya, {RowCount} satir uretildi, format {Format}",
            mappingId, files.Count, rows.Count, format);

        var writer = fileWriterFactory.GetWriter(format);
        var content = writer.Write(rows);
        return new ConvertResult(content, writer.ContentType, $"donusturulen-dosya.{writer.FileExtension}");
    }

    private async Task<(List<Dictionary<string, object?>> Rows, List<string> Warnings)> RunMappingAsync(
        string mappingId,
        IReadOnlyList<PreviewSourceFile> files)
    {
        var mapping = await mappingRepository.GetByIdAsync(mappingId)
            ?? throw new ArgumentException($"Mapping bulunamadi: {mappingId}");

        var warnings = new List<string>();

        // Her source semaya karsilik gelen dosyayi parse edip satirlarini schema-id ile
        // namespaced hale getiren yardimci; hem tekli hem coklu kaynak akisinda kullanilir.
        async Task<List<Dictionary<string, string?>>> ParseRawRows(MappingSourceSchema schemaRef)
        {
            var file = files.FirstOrDefault(f => f.SourceSchemaId == schemaRef.SourceSchemaId)
                ?? throw new ArgumentException($"'{schemaRef.Alias}' icin dosya yuklenmedi.");

            var sourceSchema = await sourceSchemaRepository.GetByIdAsync(schemaRef.SourceSchemaId)
                ?? throw new ArgumentException($"Source sema bulunamadi: {schemaRef.SourceSchemaId}");

            var parser = fileParserFactory.GetParser(sourceSchema.FileFormat);
            return parser.Parse(file.Content, sourceSchema).Rows;
        }

        if (mapping.SourceSchemas.Count == 1)
        {
            var schemaRef = mapping.SourceSchemas[0];
            var rawRows = await ParseRawRows(schemaRef);
            var namespacedRows = rawRows.Select(row => Namespace(row, schemaRef.SourceSchemaId));
            var results = namespacedRows.Select(row => mappingExecutor.Apply(mapping, row)).ToList();
            return (results, warnings);
        }

        // Coklu kaynak: her semayi ayri ayri parse edip join-key alanina gore inner join
        // ile birlestiriyoruz. Ilk sirada listelenen sema "surucu" kabul edilir.
        var perSchemaLookups = new List<(MappingSourceSchema SchemaRef, Dictionary<string, Dictionary<string, string?>> ByKey)>();

        foreach (var schemaRef in mapping.SourceSchemas)
        {
            var rawRows = await ParseRawRows(schemaRef);
            var byKey = new Dictionary<string, Dictionary<string, string?>>();

            foreach (var row in rawRows)
            {
                var keyValue = row.GetValueOrDefault(schemaRef.JoinKeyField ?? string.Empty);
                if (string.IsNullOrEmpty(keyValue))
                {
                    warnings.Add($"{schemaRef.Alias}: birleştirme anahtarı boş olan satır atlandı.");
                    continue;
                }

                // Ayni anahtara sahip birden fazla satir varsa son satir kazanir (dokumante edilen limitasyon).
                byKey[keyValue] = row;
            }

            perSchemaLookups.Add((schemaRef, byKey));
        }

        var driver = perSchemaLookups[0];
        var mergedRecords = new List<Dictionary<string, string?>>();

        foreach (var (key, driverRow) in driver.ByKey)
        {
            var merged = Namespace(driverRow, driver.SchemaRef.SourceSchemaId);
            var matchedAll = true;

            for (var i = 1; i < perSchemaLookups.Count; i++)
            {
                var (schemaRef, byKey) = perSchemaLookups[i];

                if (!byKey.TryGetValue(key, out var matchedRow))
                {
                    warnings.Add($"Birleştirme anahtarı '{key}': '{schemaRef.Alias}' içinde eşleşme bulunamadı, satır atlandı.");
                    matchedAll = false;
                    break;
                }

                foreach (var kvp in Namespace(matchedRow, schemaRef.SourceSchemaId))
                {
                    merged[kvp.Key] = kvp.Value;
                }
            }

            if (matchedAll)
            {
                mergedRecords.Add(merged);
            }
        }

        var mergedResults = mergedRecords.Select(row => mappingExecutor.Apply(mapping, row)).ToList();
        return (mergedResults, warnings);
    }

    private static Dictionary<string, string?> Namespace(Dictionary<string, string?> row, string sourceSchemaId) =>
        row.ToDictionary(kvp => SourceFieldKey.Build(sourceSchemaId, kvp.Key), kvp => kvp.Value);
}
