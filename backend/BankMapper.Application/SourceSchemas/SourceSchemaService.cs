using BankMapper.Application.Abstractions;
using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.SourceSchemas;

public class SourceSchemaService(ISourceSchemaRepository repository, IFileParserFactory fileParserFactory)
    : ISourceSchemaService
{
    public async Task<List<SourceSchemaDto>> GetAllAsync()
    {
        var schemas = await repository.GetAllAsync();
        return schemas.Select(ToDto).ToList();
    }

    public async Task<SourceSchemaDto> CreateAsync(CreateSourceSchemaRequest request)
    {
        var formatOptions = new SourceFormatOptions
        {
            HasHeader = request.HasHeader,
            Delimiter = request.Delimiter
        };

        var fields = request.FileFormat == FileFormat.FixedLength
            ? BuildManualFields(request.Fields)
            : DetectFieldsFromFile(request, formatOptions);

        var schema = new SourceSchema
        {
            Name = request.Name,
            FileFormat = request.FileFormat,
            Fields = fields,
            FormatOptions = formatOptions
        };

        var created = await repository.CreateAsync(schema);
        return ToDto(created);
    }

    private static List<SourceField> BuildManualFields(List<SourceFieldDto>? fields) =>
        (fields ?? [])
            .Select(f => new SourceField
            {
                Name = f.Name,
                Type = f.Type,
                Order = f.Order,
                StartIndex = f.StartIndex,
                Length = f.Length
            })
            .ToList();

    private List<SourceField> DetectFieldsFromFile(CreateSourceSchemaRequest request, SourceFormatOptions formatOptions)
    {
        if (request.File is null)
        {
            throw new ArgumentException("Excel/CSV formatinda alan algilamasi icin dosya yuklenmesi gerekir.");
        }

        var detectionSchema = new SourceSchema { FileFormat = request.FileFormat, FormatOptions = formatOptions };
        var parser = fileParserFactory.GetParser(request.FileFormat);
        var parsed = parser.Parse(request.File, detectionSchema);

        return parsed.FieldNames
            .Select((name, index) => new SourceField { Name = name, Type = "string", Order = index + 1 })
            .ToList();
    }

    private static SourceSchemaDto ToDto(SourceSchema schema) => new()
    {
        Id = schema.Id,
        Name = schema.Name,
        FileFormat = schema.FileFormat,
        Fields = schema.Fields
            .Select(f => new SourceFieldDto
            {
                Name = f.Name,
                Type = f.Type,
                Order = f.Order,
                StartIndex = f.StartIndex,
                Length = f.Length
            })
            .ToList(),
        FormatOptions = new SourceFormatOptionsDto
        {
            HasHeader = schema.FormatOptions.HasHeader,
            Delimiter = schema.FormatOptions.Delimiter
        }
    };
}
