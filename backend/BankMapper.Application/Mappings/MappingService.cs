using System.Text.Json;
using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.Mappings;

public class MappingService(IMappingRepository mappingRepository) : IMappingService
{
    public async Task<List<MappingDto>> GetAllAsync()
    {
        var mappings = await mappingRepository.GetAllAsync();
        return mappings.Select(ToDto).ToList();
    }

    public async Task<MappingDto?> GetByIdAsync(string id)
    {
        var mapping = await mappingRepository.GetByIdAsync(id);
        return mapping is null ? null : ToDto(mapping);
    }

    public async Task<MappingDto> CreateAsync(CreateMappingRequest request)
    {
        Validate(request);

        var mapping = new Mapping
        {
            Name = request.Name,
            SourceSchemaId = request.SourceSchemaId,
            FileTypeId = request.FileTypeId,
            FieldMappings = request.FieldMappings.Select(ToEntity).ToList(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await mappingRepository.CreateAsync(mapping);
        return ToDto(created);
    }

    public async Task<MappingDto?> UpdateAsync(string id, CreateMappingRequest request)
    {
        Validate(request);

        var existing = await mappingRepository.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        existing.Name = request.Name;
        existing.SourceSchemaId = request.SourceSchemaId;
        existing.FileTypeId = request.FileTypeId;
        existing.FieldMappings = request.FieldMappings.Select(ToEntity).ToList();
        existing.UpdatedAt = DateTime.UtcNow;

        var updated = await mappingRepository.UpdateAsync(existing);
        return updated is null ? null : ToDto(updated);
    }

    private static void Validate(CreateMappingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Mapping adı zorunludur.");
        }

        if (string.IsNullOrWhiteSpace(request.SourceSchemaId))
        {
            throw new ArgumentException("Source şema seçilmelidir.");
        }

        if (string.IsNullOrWhiteSpace(request.FileTypeId))
        {
            throw new ArgumentException("Dosya tipi seçilmelidir.");
        }

        if (request.FieldMappings.Count == 0)
        {
            throw new ArgumentException("En az bir alan eşleşmesi olmalıdır.");
        }

        if (request.FieldMappings.Any(fm => fm.SourceFields.Count == 0))
        {
            throw new ArgumentException("Her alan eşleşmesinin en az bir kaynak alanı olmalıdır.");
        }
    }

    private static FieldMapping ToEntity(FieldMappingDto dto) => new()
    {
        TargetField = dto.TargetField,
        SourceFields = dto.SourceFields,
        FunctoidChain = dto.FunctoidChain
            .Select(f => new FunctoidStep
            {
                Type = f.Type,
                Order = f.Order,
                Params = NormalizeParams(f.Params),
                AppliesTo = f.AppliesTo
            })
            .ToList()
    };

    // System.Text.Json, Dictionary<string, object> icindeki degerleri JsonElement olarak
    // deserialize eder; MongoDB'nin ObjectSerializer'i JsonElement'i taniyamadigi icin
    // kaydetmeden once bunlari duz CLR tiplerine (string/int/double/bool) ceviriyoruz.
    private static Dictionary<string, object>? NormalizeParams(Dictionary<string, object>? parameters)
    {
        if (parameters is null)
        {
            return null;
        }

        return parameters.ToDictionary(kvp => kvp.Key, kvp => NormalizeValue(kvp.Value)!);
    }

    private static object? NormalizeValue(object? value)
    {
        if (value is not JsonElement element)
        {
            return value;
        }

        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt32(out var i) ? i : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => element.GetRawText()
        };
    }

    private static MappingDto ToDto(Mapping mapping) => new()
    {
        Id = mapping.Id,
        Name = mapping.Name,
        SourceSchemaId = mapping.SourceSchemaId,
        FileTypeId = mapping.FileTypeId,
        FieldMappings = mapping.FieldMappings
            .Select(fm => new FieldMappingDto
            {
                TargetField = fm.TargetField,
                SourceFields = fm.SourceFields,
                FunctoidChain = fm.FunctoidChain
                    .Select(fc => new FunctoidStepDto { Type = fc.Type, Order = fc.Order, Params = fc.Params, AppliesTo = fc.AppliesTo })
                    .ToList()
            })
            .ToList(),
        CreatedAt = mapping.CreatedAt,
        UpdatedAt = mapping.UpdatedAt,
        CreatedBy = mapping.CreatedBy
    };
}
