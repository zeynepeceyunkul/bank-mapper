using System.Text.Json;
using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;
using BankMapper.Domain.Functoids;
using Microsoft.Extensions.Logging;

namespace BankMapper.Application.Mappings;

public class MappingService(
    IMappingRepository mappingRepository,
    ISourceSchemaRepository sourceSchemaRepository,
    IFileTypeRepository fileTypeRepository,
    FunctoidRegistry functoidRegistry,
    ILogger<MappingService> logger) : IMappingService
{
    public async Task<List<MappingDto>> GetAllAsync(MappingStatus? status = null)
    {
        var mappings = await mappingRepository.GetAllAsync(status);
        return mappings.Select(ToDto).ToList();
    }

    public async Task<PagedResult<MappingDto>> GetPagedAsync(
        int pageIndex, int pageSize, SortOption sort, string? search = null, MappingStatus? status = null)
    {
        var clampedPageIndex = Math.Max(pageIndex, 0);
        var clampedPageSize = Math.Clamp(pageSize, 1, 100);

        var (items, totalCount) = await mappingRepository.GetPagedAsync(clampedPageIndex, clampedPageSize, sort, search, status);
        return new PagedResult<MappingDto> { Items = items.Select(ToDto).ToList(), TotalCount = totalCount };
    }

    public async Task<MappingDto?> GetByIdAsync(string id)
    {
        var mapping = await mappingRepository.GetByIdAsync(id);
        return mapping is null ? null : ToDto(mapping);
    }

    public async Task<MappingDto> CreateAsync(CreateMappingRequest request, string? createdBy = null)
    {
        var mapping = BuildEntity(request);
        mapping.CreatedAt = DateTime.UtcNow;
        mapping.UpdatedAt = DateTime.UtcNow;
        mapping.CreatedBy = createdBy;

        await ValidateAsync(mapping);

        var created = await mappingRepository.CreateAsync(mapping);
        logger.LogInformation(
            "Mapping {MappingId} olusturuldu, {SourceSchemaCount} source sema kullanildi",
            created.Id, created.SourceSchemas.Count);
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

        // Onaylanmis bir mapping duzenlenirse tekrar onaya dusuyor (bkz.
        // Mapping.Status uzerindeki yorum) - onceki onay bilgisi artik
        // gecersiz oldugu icin temizleniyor.
        updatedMapping.Status = MappingStatus.PendingApproval;
        updatedMapping.ApprovedBy = null;
        updatedMapping.ApprovedAt = null;
        updatedMapping.RejectionReason = null;
        updatedMapping.RejectedBy = null;
        updatedMapping.RejectedAt = null;

        await ValidateAsync(updatedMapping);

        var updated = await mappingRepository.UpdateAsync(updatedMapping);
        if (updated is not null)
        {
            logger.LogInformation(
                "Mapping {MappingId} guncellendi, {SourceSchemaCount} source sema kullanildi",
                updated.Id, updated.SourceSchemas.Count);
        }
        return updated is null ? null : ToDto(updated);
    }

    // SourceSchema'nin aksine, hicbir baska kayit bir Mapping'e referans
    // vermiyor - koşulsuz silinebilir, engelleyici bir bagimlilik kontrolune
    // gerek yok.
    public async Task<bool> DeleteAsync(string id)
    {
        var deleted = await mappingRepository.DeleteAsync(id);
        if (deleted)
        {
            logger.LogInformation("Mapping {MappingId} silindi", id);
        }
        return deleted;
    }

    public async Task<MappingDto?> ApproveAsync(string id, string? approvedBy)
    {
        var existing = await mappingRepository.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        existing.Status = MappingStatus.Approved;
        existing.ApprovedBy = approvedBy;
        existing.ApprovedAt = DateTime.UtcNow;
        existing.RejectionReason = null;
        existing.RejectedBy = null;
        existing.RejectedAt = null;

        var updated = await mappingRepository.UpdateAsync(existing);
        if (updated is not null)
        {
            logger.LogInformation("Mapping {MappingId} onaylandi", id);
        }
        return updated is null ? null : ToDto(updated);
    }

    public async Task<MappingDto?> RejectAsync(string id, string reason, string? rejectedBy)
    {
        var existing = await mappingRepository.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Red gerekçesi zorunludur.");
        }

        existing.Status = MappingStatus.Rejected;
        existing.RejectionReason = reason;
        existing.RejectedBy = rejectedBy;
        existing.RejectedAt = DateTime.UtcNow;
        existing.ApprovedBy = null;
        existing.ApprovedAt = null;

        var updated = await mappingRepository.UpdateAsync(existing);
        if (updated is not null)
        {
            logger.LogInformation("Mapping {MappingId} reddedildi", id);
        }
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

    private async Task ValidateAsync(Mapping mapping)
    {
        if (string.IsNullOrWhiteSpace(mapping.Name))
        {
            throw new ArgumentException("Mapping adı zorunludur.");
        }

        // SourceSchema'nin aksine (ayni isimde otomatik " (1)" eklenir) burada
        // sessizce yeniden adlandirmiyoruz, direkt reddediyoruz - mapping,
        // Onizleme ekraninda ISME BAKILARAK secilip gercek bir donusturme
        // calistirilan bir sey, neredeyse ayni iki isim orada yanlislikla
        // birbirine karisabilir.
        var allMappings = await mappingRepository.GetAllAsync();
        var nameConflict = allMappings.Any(m =>
            m.Id != mapping.Id && string.Equals(m.Name, mapping.Name, StringComparison.OrdinalIgnoreCase));

        if (nameConflict)
        {
            throw new ArgumentException($"Bu isimde bir mapping zaten var: {mapping.Name}");
        }

        if (mapping.SourceSchemas.Count != 1)
        {
            throw new ArgumentException("Tam olarak bir source şema seçilmelidir.");
        }

        if (string.IsNullOrWhiteSpace(mapping.FileTypeId))
        {
            throw new ArgumentException("Dosya tipi seçilmelidir.");
        }

        var sourceSchemaId = mapping.SourceSchemas[0].SourceSchemaId;
        var sourceSchema = await sourceSchemaRepository.GetByIdAsync(sourceSchemaId)
            ?? throw new ArgumentException($"Source şema bulunamadı: {sourceSchemaId}");

        var fileType = await fileTypeRepository.GetByIdAsync(mapping.FileTypeId)
            ?? throw new ArgumentException($"Dosya tipi bulunamadı: {mapping.FileTypeId}");

        var sourceFieldNames = sourceSchema.Fields.Select(f => f.Name).ToHashSet();
        var targetFieldNames = fileType.TargetFields.Select(f => f.Name).ToHashSet();

        var sourceSchemaIds = mapping.SourceSchemas.Select(s => s.SourceSchemaId).ToHashSet();
        var nodeIds = mapping.FunctoidNodes.Select(n => n.Id)
            .Concat(mapping.ConstantNodes.Select(c => c.Id))
            .ToHashSet();

        foreach (var edge in mapping.Edges)
        {
            if (edge.FromKind == EdgeEndpointKind.SourceField)
            {
                if (!sourceSchemaIds.Contains(edge.FromSourceSchemaId ?? string.Empty))
                {
                    throw new ArgumentException($"Bağlantı bilinmeyen bir source şemaya işaret ediyor: {edge.FromSourceSchemaId}");
                }

                if (!sourceFieldNames.Contains(edge.FromFieldName ?? string.Empty))
                {
                    throw new ArgumentException($"Bağlantı, source şemada bulunmayan bir alana işaret ediyor: {edge.FromFieldName}");
                }
            }

            if (edge.FromKind is EdgeEndpointKind.NodeOutput or EdgeEndpointKind.ConstantOutput && !nodeIds.Contains(edge.FromNodeId ?? string.Empty))
            {
                throw new ArgumentException($"Bağlantı bilinmeyen bir node'a işaret ediyor: {edge.FromNodeId}");
            }

            if (edge.ToKind == EdgeEndpointKind.NodeInput && !nodeIds.Contains(edge.ToNodeId ?? string.Empty))
            {
                throw new ArgumentException($"Bağlantı bilinmeyen bir node'a işaret ediyor: {edge.ToNodeId}");
            }

            if (edge.ToKind == EdgeEndpointKind.TargetField && !targetFieldNames.Contains(edge.ToFieldName ?? string.Empty))
            {
                throw new ArgumentException($"Bağlantı, dosya tipinde bulunmayan bir hedef alana işaret ediyor: {edge.ToFieldName}");
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

        // Bir hedef alana giden edge'in var olmasi, o degerin gercekten
        // uretildigi anlamina gelmiyor: ara bir functoid'in girisi bos
        // birakilmissa MappingExecutor o girisi sessizce null'a cozumluyor
        // (bkz. MappingExecutor.ResolveNodeInput). Burada hedefe (dogrudan ya
        // da baska functoid'ler uzerinden) ulasan her node'u geriye dogru
        // izleyip TUM giris portlarinin dolu oldugunu dogruluyoruz - zorunlu/
        // zorunlu-olmayan hedef alan ayrimi yapmiyoruz, ikisi de ayni sekilde
        // sessizce yanlis/bos deger uretebilir. Hedefe hic ulasmayan, canvas'ta
        // unutulmus bagimsiz functoid'ler bu kontrolun disinda birakiliyor
        // (calisma zamaninda zaten hic kullanilmiyorlar).
        var nodesReachingTarget = new HashSet<string>();
        var toVisit = new Queue<string>(mapping.Edges
            .Where(e => e.ToKind == EdgeEndpointKind.TargetField && e.FromKind == EdgeEndpointKind.NodeOutput)
            .Select(e => e.FromNodeId!));

        foreach (var id in toVisit)
        {
            nodesReachingTarget.Add(id);
        }

        while (toVisit.Count > 0)
        {
            var nodeId = toVisit.Dequeue();
            var upstreamNodeIds = mapping.Edges
                .Where(e => e.ToKind == EdgeEndpointKind.NodeInput && e.ToNodeId == nodeId && e.FromKind == EdgeEndpointKind.NodeOutput)
                .Select(e => e.FromNodeId!);

            foreach (var upstreamNodeId in upstreamNodeIds)
            {
                if (nodesReachingTarget.Add(upstreamNodeId))
                {
                    toVisit.Enqueue(upstreamNodeId);
                }
            }
        }

        var incompleteFunctoidCodes = mapping.FunctoidNodes
            .Where(n => nodesReachingTarget.Contains(n.Id))
            .Where(n =>
            {
                var connectedPorts = mapping.Edges
                    .Where(e => e.ToKind == EdgeEndpointKind.NodeInput && e.ToNodeId == n.Id)
                    .Select(e => e.ToPort)
                    .ToHashSet();

                return functoidRegistry.Get(n.FunctoidCode).InputPorts.Any(port => !connectedPorts.Contains(port));
            })
            .Select(n => n.FunctoidCode)
            .ToList();

        if (incompleteFunctoidCodes.Count > 0)
        {
            throw new ArgumentException(
                $"Şu functoid'lerin girişleri tam bağlanmadan mapping kaydedilemez: {string.Join(", ", incompleteFunctoidCodes)}");
        }

        var connectedTargetFields = mapping.Edges
            .Where(e => e.ToKind == EdgeEndpointKind.TargetField)
            .Select(e => e.ToFieldName)
            .ToHashSet();

        var missingRequiredFields = fileType.TargetFields
            .Where(f => f.IsRequired && !connectedTargetFields.Contains(f.Name))
            .Select(f => f.Name)
            .ToList();

        if (missingRequiredFields.Count > 0)
        {
            throw new ArgumentException(
                $"Şu zorunlu hedef alanlar bağlanmadan mapping kaydedilemez: {string.Join(", ", missingRequiredFields)}");
        }
    }

    private static MappingSourceSchema ToEntity(MappingSourceSchemaDto dto) => new()
    {
        SourceSchemaId = dto.SourceSchemaId,
        Alias = dto.Alias,
        PositionX = dto.PositionX,
        PositionY = dto.PositionY
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
            .Select(s => new MappingSourceSchemaDto
            {
                SourceSchemaId = s.SourceSchemaId,
                Alias = s.Alias,
                PositionX = s.PositionX,
                PositionY = s.PositionY
            })
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
        CreatedBy = mapping.CreatedBy,
        Status = mapping.Status,
        ApprovedBy = mapping.ApprovedBy,
        ApprovedAt = mapping.ApprovedAt,
        RejectionReason = mapping.RejectionReason,
        RejectedBy = mapping.RejectedBy,
        RejectedAt = mapping.RejectedAt
    };
}
