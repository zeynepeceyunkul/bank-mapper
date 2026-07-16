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
        var mapping = await mappingRepository.GetByIdAsync(mappingId)
            ?? throw new ArgumentException($"Mapping bulunamadi: {mappingId}");

        var sourceSchema = await sourceSchemaRepository.GetByIdAsync(mapping.SourceSchemaId)
            ?? throw new ArgumentException($"Source sema bulunamadi: {mapping.SourceSchemaId}");

        var parser = fileParserFactory.GetParser(sourceSchema.FileFormat);
        var parsed = parser.Parse(file, sourceSchema);

        return parsed.Rows
            .Take(MaxPreviewRows)
            .Select(row => mappingExecutor.Apply(mapping, row))
            .ToList();
    }
}
