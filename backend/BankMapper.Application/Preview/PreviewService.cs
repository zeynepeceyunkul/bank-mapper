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

        var schemaRef = mapping.SourceSchemas[0];

        var file = files.FirstOrDefault(f => f.SourceSchemaId == schemaRef.SourceSchemaId)
            ?? throw new ArgumentException($"'{schemaRef.Alias}' icin dosya yuklenmedi.");

        var sourceSchema = await sourceSchemaRepository.GetByIdAsync(schemaRef.SourceSchemaId)
            ?? throw new ArgumentException($"Source sema bulunamadi: {schemaRef.SourceSchemaId}");

        var parser = fileParserFactory.GetParser(sourceSchema.FileFormat);
        List<Dictionary<string, string?>> rawRows;

        try
        {
            rawRows = parser.Parse(file.Content, sourceSchema).Rows;
        }
        catch (Exception ex) when (ex is not ArgumentException)
        {
            // CsvHelper/ClosedXML gibi kutuphaneler, format olarak gecersiz bir
            // dosyaya (orn. yeniden adlandirilmis bir PDF) genellikle kendi ic
            // exception tiplerini firlatiyor - bunlar yakalanmazsa 500 (sunucu
            // hatasi) olarak donuyordu, ama aslinda bu bir kullanici/girdi hatasi.
            // ArgumentException'a ceviriyoruz ki GlobalExceptionHandler bunu 400
            // olarak dondursun. Kendi firlattigimiz ArgumentException'lar (orn.
            // "Beklenen sutun bulunamadi") zaten spesifik mesajlariyla degismeden
            // gecsin diye burada tekrar sarmalanmiyor.
            throw new ArgumentException(
                $"'{schemaRef.Alias}' için yüklenen dosya geçerli bir {sourceSchema.FileFormat} dosyası değil.", ex);
        }

        var namespacedRows = rawRows.Select(row => Namespace(row, schemaRef.SourceSchemaId));
        var results = namespacedRows.Select(row => mappingExecutor.Apply(mapping, row)).ToList();
        return (results, []);
    }

    private static Dictionary<string, string?> Namespace(Dictionary<string, string?> row, string sourceSchemaId) =>
        row.ToDictionary(kvp => SourceFieldKey.Build(sourceSchemaId, kvp.Key), kvp => kvp.Value);
}
