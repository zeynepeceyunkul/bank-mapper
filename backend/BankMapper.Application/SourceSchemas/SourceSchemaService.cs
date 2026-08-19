using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Application.FileParsing;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.SourceSchemas;

public class SourceSchemaService(
    ISourceSchemaRepository repository,
    IFileParserFactory fileParserFactory,
    IMappingRepository mappingRepository)
    : ISourceSchemaService
{
    public async Task<List<SourceSchemaDto>> GetAllAsync()
    {
        var schemas = await repository.GetAllAsync();
        return schemas.Select(ToDto).ToList();
    }

    public async Task<PagedResult<SourceSchemaDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null)
    {
        var clampedPageIndex = Math.Max(pageIndex, 0);
        var clampedPageSize = Math.Clamp(pageSize, 1, 100);

        var (items, totalCount) = await repository.GetPagedAsync(clampedPageIndex, clampedPageSize, sort, search);
        return new PagedResult<SourceSchemaDto> { Items = items.Select(ToDto).ToList(), TotalCount = totalCount };
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

    public async Task<bool> DeleteAsync(string id)
    {
        var existing = await repository.GetByIdAsync(id);
        if (existing is null)
        {
            return false;
        }

        var referencingMappings = (await mappingRepository.GetAllAsync())
            .Where(m => m.SourceSchemas.Any(s => s.SourceSchemaId == id))
            .Select(m => m.Name)
            .ToList();

        if (referencingMappings.Count > 0)
        {
            throw new ArgumentException(
                $"Bu şema şu mapping(ler) tarafından kullanılıyor, silinemez: {string.Join(", ", referencingMappings)}"
            );
        }

        return await repository.DeleteAsync(id);
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
        ParsedFileResult parsed;

        try
        {
            parsed = parser.Parse(request.File, detectionSchema);
        }
        catch (Exception ex) when (ex is not ArgumentException)
        {
            // PreviewService.RunMappingAsync'deki ayni korumanin eslenigi -
            // sema OLUSTURMA sirasindaki dosya yukleme yolu bu korumaya sahip
            // degildi. ClosedXML/CsvHelper gecersiz bir dosyada kendi ic
            // exception tiplerini (orn. FormatException) firlatiyor;
            // yakalanmazsa GlobalExceptionHandler bunu yanlislikla "Gecersiz id
            // formati" olarak yorumluyordu (FormatException'i baska bir amacla
            // - route id parse hatalari icin - eslesen bir dal), tamamen
            // alakasiz ve kafa karistirici bir mesaj.
            throw new ArgumentException(
                $"Yüklenen dosya geçerli bir {request.FileFormat} dosyası değil.", ex);
        }

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
