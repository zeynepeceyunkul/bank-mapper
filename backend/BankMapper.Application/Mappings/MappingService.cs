using System.Text.Json;
using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;

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
        var mapping = BuildEntity(request);
        mapping.CreatedAt = DateTime.UtcNow;
        mapping.UpdatedAt = DateTime.UtcNow;

        Validate(mapping);

        var created = await mappingRepository.CreateAsync(mapping);
        return ToDto(created);
    }

    public async Task<MappingDto?> UpdateAsync(string id, CreateMappingRequest request)
    {
        var existing = await mappingRepository.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        var updatedMapping = BuildEntity(request);
        updatedMapping.Id = existing.Id;
        updatedMapping.CreatedAt = existing.CreatedAt;
        updatedMapping.CreatedBy = existing.CreatedBy;
        updatedMapping.UpdatedAt = DateTime.UtcNow;

        Validate(updatedMapping);

        var updated = await mappingRepository.UpdateAsync(updatedMapping);
        return updated is null ? null : ToDto(updated);
    }

    private static Mapping BuildEntity(CreateMappingRequest request) => new()
    {
        Name = request.Name,
        SourceSchemas = request.SourceSchemas.Select(ToEntity).ToList(),
        FileTypeId = request.FileTypeId,
        FunctoidNodes = request.FunctoidNodes.Select(ToEntity).ToList(),
        ConstantNodes = request.ConstantNodes.Select(ToEntity).ToList(),
        Edges = request.Edges.Select(ToEntity).ToList()
    };

    private static void Validate(Mapping mapping)
    {
        if (string.IsNullOrWhiteSpace(mapping.Name))
        {
            throw new ArgumentException("Mapping adı zorunludur.");
        }

        if (mapping.SourceSchemas.Count == 0)
        {
            throw new ArgumentException("En az bir source şema seçilmelidir.");
        }

        if (mapping.SourceSchemas.Count > 1 && mapping.SourceSchemas.Any(s => string.IsNullOrWhiteSpace(s.JoinKeyField)))
        {
            throw new ArgumentException("Birden fazla source şema kullanılıyorsa her biri için birleştirme anahtarı (join key) seçilmelidir.");
        }

        if (string.IsNullOrWhiteSpace(mapping.FileTypeId))
        {
            throw new ArgumentException("Dosya tipi seçilmelidir.");
        }

        var sourceSchemaIds = mapping.SourceSchemas.Select(s => s.SourceSchemaId).ToHashSet();
        var nodeIds = mapping.FunctoidNodes.Select(n => n.Id)
            .Concat(mapping.ConstantNodes.Select(c => c.Id))
            .ToHashSet();

        foreach (var edge in mapping.Edges)
        {
            if (edge.FromKind == EdgeEndpointKind.SourceField && !sourceSchemaIds.Contains(edge.FromSourceSchemaId ?? string.Empty))
            {
                throw new ArgumentException($"Bağlantı bilinmeyen bir source şemaya işaret ediyor: {edge.FromSourceSchemaId}");
            }

            if (edge.FromKind is EdgeEndpointKind.NodeOutput or EdgeEndpointKind.ConstantOutput && !nodeIds.Contains(edge.FromNodeId ?? string.Empty))
            {
                throw new ArgumentException($"Bağlantı bilinmeyen bir node'a işaret ediyor: {edge.FromNodeId}");
            }

            if (edge.ToKind == EdgeEndpointKind.NodeInput && !nodeIds.Contains(edge.ToNodeId ?? string.Empty))
            {
                throw new ArgumentException($"Bağlantı bilinmeyen bir node'a işaret ediyor: {edge.ToNodeId}");
            }
        }

        var duplicateNodeInput = mapping.Edges
            .Where(e => e.ToKind == EdgeEndpointKind.NodeInput)
            .GroupBy(e => (e.ToNodeId, e.ToPort))
            .Any(g => g.Count() > 1);

        if (duplicateNodeInput)
        {
            throw new ArgumentException("Bir giriş portuna en fazla bir bağlantı çekilebilir.");
        }

        var duplicateTargetField = mapping.Edges
            .Where(e => e.ToKind == EdgeEndpointKind.TargetField)
            .GroupBy(e => e.ToFieldName)
            .Any(g => g.Count() > 1);

        if (duplicateTargetField)
        {
            throw new ArgumentException("Bir hedef alana en fazla bir bağlantı çekilebilir.");
        }

        if (!mapping.Edges.Any(e => e.ToKind == EdgeEndpointKind.TargetField))
        {
            throw new ArgumentException("En az bir hedef alan bağlantısı olmalıdır.");
        }

        try
        {
            GraphTopologicalSorter.Sort(mapping);
        }
        catch (InvalidOperationException ex)
        {
            throw new ArgumentException(ex.Message);
        }
    }

    private static MappingSourceSchema ToEntity(MappingSourceSchemaDto dto) => new()
    {
        SourceSchemaId = dto.SourceSchemaId,
        Alias = dto.Alias,
        JoinKeyField = dto.JoinKeyField
    };

    private static FunctoidNode ToEntity(FunctoidNodeDto dto) => new()
    {
        Id = dto.Id,
        FunctoidCode = dto.FunctoidCode,
        Params = NormalizeParams(dto.Params),
        PositionX = dto.PositionX,
        PositionY = dto.PositionY
    };

    private static ConstantNode ToEntity(ConstantNodeDto dto) => new()
    {
        Id = dto.Id,
        Value = dto.Value,
        PositionX = dto.PositionX,
        PositionY = dto.PositionY
    };

    private static GraphEdge ToEntity(GraphEdgeDto dto) => new()
    {
        Id = dto.Id,
        FromKind = dto.FromKind,
        FromSourceSchemaId = dto.FromSourceSchemaId,
        FromFieldName = dto.FromFieldName,
        FromNodeId = dto.FromNodeId,
        ToKind = dto.ToKind,
        ToNodeId = dto.ToNodeId,
        ToPort = dto.ToPort,
        ToFieldName = dto.ToFieldName
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
        SourceSchemas = mapping.SourceSchemas
            .Select(s => new MappingSourceSchemaDto { SourceSchemaId = s.SourceSchemaId, Alias = s.Alias, JoinKeyField = s.JoinKeyField })
            .ToList(),
        FileTypeId = mapping.FileTypeId,
        FunctoidNodes = mapping.FunctoidNodes
            .Select(n => new FunctoidNodeDto { Id = n.Id, FunctoidCode = n.FunctoidCode, Params = n.Params, PositionX = n.PositionX, PositionY = n.PositionY })
            .ToList(),
        ConstantNodes = mapping.ConstantNodes
            .Select(c => new ConstantNodeDto { Id = c.Id, Value = c.Value, PositionX = c.PositionX, PositionY = c.PositionY })
            .ToList(),
        Edges = mapping.Edges
            .Select(e => new GraphEdgeDto
            {
                Id = e.Id,
                FromKind = e.FromKind,
                FromSourceSchemaId = e.FromSourceSchemaId,
                FromFieldName = e.FromFieldName,
                FromNodeId = e.FromNodeId,
                ToKind = e.ToKind,
                ToNodeId = e.ToNodeId,
                ToPort = e.ToPort,
                ToFieldName = e.ToFieldName
            })
            .ToList(),
        CreatedAt = mapping.CreatedAt,
        UpdatedAt = mapping.UpdatedAt,
        CreatedBy = mapping.CreatedBy
    };
}
