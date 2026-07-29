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
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Şema adı zorunludur.");
        }

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
            Name = await ResolveUniqueNameAsync(request.Name.Trim()),
            FileFormat = request.FileFormat,
            Fields = fields,
            FormatOptions = formatOptions
        };

        var created = await repository.CreateAsync(schema);
        return ToDto(created);
    }

    // Ayni isimde bir sema zaten varsa engellemek yerine (kullaniciyi farkli
    // bir isim dusunmeye zorlamak gereksiz surtunme yaratir) tarayicilarin
    // indirilen dosyalara yaptigi gibi otomatik olarak " (1)", " (2)" ekleyip
    // ilk bos olani buluyoruz.
    private async Task<string> ResolveUniqueNameAsync(string requestedName)
    {
        var existingNames = (await repository.GetAllAsync())
            .Select(s => s.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!existingNames.Contains(requestedName))
        {
            return requestedName;
        }

        var suffix = 1;
        string candidate;
        do
        {
            candidate = $"{requestedName} ({suffix})";
            suffix++;
        } while (existingNames.Contains(candidate));

        return candidate;
    }

    private static List<SourceField> BuildManualFields(List<SourceFieldDto>? fields)
    {
        if (fields is null || fields.Count == 0)
        {
            throw new ArgumentException("Sabit uzunluklu şema için en az bir alan tanımlamalısınız.");
        }

        return fields
            .Select(f => new SourceField
            {
                Name = f.Name,
                Type = f.Type,
                Order = f.Order,
                StartIndex = f.StartIndex,
                Length = f.Length
            })
            .ToList();
    }

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
