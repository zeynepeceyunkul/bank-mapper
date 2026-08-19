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
    IFileTypeRepository fileTypeRepository,
    IFileParserFactory fileParserFactory,
    MappingExecutor mappingExecutor,
    IFileWriterFactory fileWriterFactory,
    IMappingRunRepository mappingRunRepository,
    ILogger<PreviewService> logger) : IPreviewService
{
    private const int MaxPreviewRows = 50;

    public async Task<PreviewExecuteResult> ExecuteAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files)
    {
        var mapping = await mappingRepository.GetByIdAsync(mappingId)
            ?? throw new ArgumentException($"Mapping bulunamadi: {mappingId}");
        EnsureApproved(mapping);

        try
        {
            var (rows, warnings) = await RunMappingAsync(mapping, files);
            logger.LogInformation(
                "Onizleme calistirildi: mapping {MappingId}, {FileCount} dosya, {RowCount} satir uretildi",
                mappingId, files.Count, rows.Count);
            await RecordRunAsync(mapping, RunKind.Preview, files, success: true, rowCount: rows.Count, errorMessage: null);
            return new PreviewExecuteResult { Rows = rows.Take(MaxPreviewRows).ToList(), Warnings = warnings };
        }
        catch (ArgumentException ex)
        {
            await RecordRunAsync(mapping, RunKind.Preview, files, success: false, rowCount: null, errorMessage: ex.Message);
            throw;
        }
    }

    public async Task<ConvertResult> ConvertAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files, FileFormat format)
    {
        var mapping = await mappingRepository.GetByIdAsync(mappingId)
            ?? throw new ArgumentException($"Mapping bulunamadi: {mappingId}");
        EnsureApproved(mapping);

        try
        {
            var (rows, _) = await RunMappingAsync(mapping, files);
            logger.LogInformation(
                "Donusturme calistirildi: mapping {MappingId}, {FileCount} dosya, {RowCount} satir uretildi, format {Format}",
                mappingId, files.Count, rows.Count, format);
            await RecordRunAsync(mapping, RunKind.Convert, files, success: true, rowCount: rows.Count, errorMessage: null);

            var writer = fileWriterFactory.GetWriter(format);
            var content = writer.Write(rows);
            return new ConvertResult(content, writer.ContentType, $"donusturulen-dosya.{writer.FileExtension}");
        }
        catch (ArgumentException ex)
        {
            await RecordRunAsync(mapping, RunKind.Convert, files, success: false, rowCount: null, errorMessage: ex.Message);
            throw;
        }
    }

    // Calistirma gecmisi kaydi - basarili da basarisiz da olsa "dun gece
    // yukledigim dosya duzgun mu islendi" sorusuna cevap verebilmek icin her
    // iki durumda da kaydediliyor. Sadece mapping id'si gecersizse (mapping
    // hic bulunamadiginda) buraya hic ulasilmiyor - o durumda kaydedilecek
    // anlamli bir mapping adi olmadigi icin gecmise hic yazilmiyor.
    private async Task RecordRunAsync(
        Mapping mapping, RunKind kind, IReadOnlyList<PreviewSourceFile> files, bool success, int? rowCount, string? errorMessage) =>
        await mappingRunRepository.CreateAsync(new MappingRun
        {
            MappingId = mapping.Id,
            MappingName = mapping.Name,
            Kind = kind,
            FileNames = files.Select(f => f.FileName).ToList(),
            Success = success,
            RowCount = rowCount,
            ErrorMessage = errorMessage,
            RunAt = DateTime.UtcNow,
        });

    // Frontend zaten Onizleme dropdown'unu sadece Onaylanmis mapping'lerle
    // dolduruyor, ama bu sadece bir UI kolayligi - asil koruma burada olmali,
    // yoksa API'ye dogrudan istek atarak henuz onaylanmamis bir mapping'i
    // calistirmak mumkun olurdu.
    private static void EnsureApproved(Mapping mapping)
    {
        if (mapping.Status != MappingStatus.Approved)
        {
            throw new ArgumentException($"'{mapping.Name}' mapping'i henuz onaylanmadi, donusturmede kullanilamaz.");
        }
    }

    private async Task<(List<Dictionary<string, object?>> Rows, List<string> Warnings)> RunMappingAsync(
        Mapping mapping,
        IReadOnlyList<PreviewSourceFile> files)
    {
        var schemaRef = mapping.SourceSchemas[0];

        var file = files.FirstOrDefault(f => f.SourceSchemaId == schemaRef.SourceSchemaId)
            ?? throw new ArgumentException($"'{schemaRef.Alias}' icin dosya yuklenmedi.");

        var sourceSchema = await sourceSchemaRepository.GetByIdAsync(schemaRef.SourceSchemaId)
            ?? throw new ArgumentException($"Source sema bulunamadi: {schemaRef.SourceSchemaId}");

        var fileType = await fileTypeRepository.GetByIdAsync(mapping.FileTypeId)
            ?? throw new ArgumentException($"Dosya tipi bulunamadi: {mapping.FileTypeId}");

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
        var results = namespacedRows.Select(row => mappingExecutor.Apply(mapping, row, fileType.TargetFields)).ToList();
        return (results, []);
    }

    private static Dictionary<string, string?> Namespace(Dictionary<string, string?> row, string sourceSchemaId) =>
        row.ToDictionary(kvp => SourceFieldKey.Build(sourceSchemaId, kvp.Key), kvp => kvp.Value);
}
