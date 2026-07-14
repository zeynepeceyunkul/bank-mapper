using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.Mappings;

public class MappingService(IMappingRepository mappingRepository) : IMappingService
{
    public async Task<MappingDto> CreateAsync(CreateMappingRequest request)
    {
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

    private static FieldMapping ToEntity(FieldMappingDto dto) => new()
    {
        TargetField = dto.TargetField,
        SourceFields = dto.SourceFields,
        FunctoidChain = dto.FunctoidChain
            .Select(f => new FunctoidStep { Type = f.Type, Order = f.Order, Params = f.Params, AppliesTo = f.AppliesTo })
            .ToList()
    };

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
