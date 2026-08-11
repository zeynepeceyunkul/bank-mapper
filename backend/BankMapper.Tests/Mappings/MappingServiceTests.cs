using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Application.Mappings;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BankMapper.Tests.Mappings;

public class MappingServiceTests
{
    private const string SchemaId = "src1";
    private const string FileTypeId = "ft1";

    private static MappingService CreateService() => new(
        new FakeMappingRepository(),
        new FakeSourceSchemaRepository(),
        new FakeFileTypeRepository(),
        NullLogger<MappingService>.Instance);

    private static CreateMappingRequest ValidRequestBase() => new()
    {
        Name = "Test Mapping",
        FileTypeId = FileTypeId,
        SourceSchemas = [new MappingSourceSchemaDto { SourceSchemaId = SchemaId, Alias = "Kaynak" }],
    };

    [Fact]
    public async Task Duplicate_edge_into_same_input_port_is_rejected()
    {
        var request = ValidRequestBase();
        request.FunctoidNodes = [new FunctoidNodeDto { Id = "n1", FunctoidCode = "Trim" }];
        request.Edges =
        [
            new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Soyad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n1", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" },
        ];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("giriş portuna", ex.Message);
    }

    [Fact]
    public async Task Cycle_in_functoid_graph_is_rejected()
    {
        var request = ValidRequestBase();
        request.FunctoidNodes =
        [
            new FunctoidNodeDto { Id = "n1", FunctoidCode = "Trim" },
            new FunctoidNodeDto { Id = "n2", FunctoidCode = "Upper" },
        ];
        request.Edges =
        [
            new GraphEdgeDto { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n1", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n2", ToPort = "value" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n2", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n1", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" },
        ];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("döngü", ex.Message);
    }

    [Fact]
    public async Task Constant_node_can_feed_a_functoid_alongside_a_source_field()
    {
        var request = ValidRequestBase();
        request.ConstantNodes = [new ConstantNodeDto { Id = "c1", Value = " " }];
        request.FunctoidNodes = [new FunctoidNodeDto { Id = "n1", FunctoidCode = "Concat" }];
        request.Edges =
        [
            new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value1" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.ConstantOutput, FromNodeId = "c1", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value2" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n1", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "AdSoyad" },
        ];

        var result = await CreateService().CreateAsync(request);

        Assert.Single(result.ConstantNodes);
        Assert.Equal(3, result.Edges.Count);
    }

    [Fact]
    public async Task Multiple_source_schemas_are_rejected()
    {
        var request = ValidRequestBase();
        request.SourceSchemas =
        [
            new MappingSourceSchemaDto { SourceSchemaId = "src1", Alias = "A" },
            new MappingSourceSchemaDto { SourceSchemaId = "src2", Alias = "B" },
        ];
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = "src1", FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("Tam olarak bir source şema", ex.Message);
    }

    [Fact]
    public async Task No_source_schema_is_rejected()
    {
        var request = ValidRequestBase();
        request.SourceSchemas = [];
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("Tam olarak bir source şema", ex.Message);
    }

    [Fact]
    public async Task Edge_referencing_a_nonexistent_source_field_is_rejected()
    {
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Iban_No", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("source şemada bulunmayan", ex.Message);
    }

    [Fact]
    public async Task Edge_referencing_a_nonexistent_target_field_is_rejected()
    {
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "SoyadYok" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("dosya tipinde bulunmayan", ex.Message);
    }

    [Fact]
    public async Task Mapping_missing_a_required_target_field_connection_is_rejected()
    {
        var service = new MappingService(
            new FakeMappingRepository(),
            new FakeSourceSchemaRepository(),
            new FakeFileTypeRepository([new TargetField { Name = "Ad" }, new TargetField { Name = "IBAN", IsRequired = true }]),
            NullLogger<MappingService>.Instance);

        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request));
        Assert.Contains("IBAN", ex.Message);
        Assert.Contains("zorunlu hedef alanlar", ex.Message);
    }

    [Fact]
    public async Task Mapping_with_all_required_target_fields_connected_is_created()
    {
        var service = new MappingService(
            new FakeMappingRepository(),
            new FakeSourceSchemaRepository(),
            new FakeFileTypeRepository([new TargetField { Name = "Ad" }, new TargetField { Name = "IBAN", IsRequired = true }]),
            NullLogger<MappingService>.Instance);

        var request = ValidRequestBase();
        request.Edges =
        [
            new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" },
            new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "IBAN", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "IBAN" },
        ];

        var result = await service.CreateAsync(request);

        Assert.Equal(2, result.Edges.Count);
    }

    [Fact]
    public async Task Valid_single_schema_mapping_is_created()
    {
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "IBAN", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "IBAN" }];

        var result = await CreateService().CreateAsync(request);

        Assert.NotEmpty(result.Id);
        Assert.Single(result.SourceSchemas);
        Assert.Single(result.Edges);
    }

    [Fact]
    public async Task Creating_a_mapping_with_an_already_used_name_is_rejected()
    {
        var service = CreateService();
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
        await service.CreateAsync(request);

        var second = ValidRequestBase();
        second.Name = "test mapping"; // buyuk/kucuk harf farkli, hala cakisma sayilmali
        second.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "IBAN", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "IBAN" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(second));
        Assert.Contains("Bu isimde bir mapping zaten var", ex.Message);
    }

    [Fact]
    public async Task Updating_a_mapping_to_keep_its_own_name_is_allowed()
    {
        var service = CreateService();
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
        var created = await service.CreateAsync(request);

        var updated = await service.UpdateAsync(created.Id, request);

        Assert.NotNull(updated);
        Assert.Equal(request.Name, updated!.Name);
    }

    [Fact]
    public async Task Updating_a_mapping_to_another_mappings_name_is_rejected()
    {
        var service = CreateService();
        var first = ValidRequestBase();
        first.Name = "Birinci";
        first.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
        await service.CreateAsync(first);

        var second = ValidRequestBase();
        second.Name = "Ikinci";
        second.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "IBAN", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "IBAN" }];
        var createdSecond = await service.CreateAsync(second);

        var renameToFirst = ValidRequestBase();
        renameToFirst.Name = "Birinci";
        renameToFirst.Edges = second.Edges;

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateAsync(createdSecond.Id, renameToFirst));
        Assert.Contains("Bu isimde bir mapping zaten var", ex.Message);
    }

    [Fact]
    public async Task DeleteAsync_removes_the_mapping_and_returns_true()
    {
        var service = CreateService();
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
        var created = await service.CreateAsync(request);

        var deleted = await service.DeleteAsync(created.Id);

        Assert.True(deleted);
        Assert.Null(await service.GetByIdAsync(created.Id));
    }

    [Fact]
    public async Task DeleteAsync_returns_false_for_an_unknown_id()
    {
        var deleted = await CreateService().DeleteAsync("does-not-exist");

        Assert.False(deleted);
    }

    [Fact]
    public async Task GetPagedAsync_returns_only_the_requested_page_and_the_real_total_count()
    {
        var service = CreateService();
        for (var i = 0; i < 5; i++)
        {
            var request = ValidRequestBase();
            request.Name = $"Mapping {i}";
            request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
            await service.CreateAsync(request);
        }

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 2, SortOption.RecentFirst);

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.TotalCount);
    }

    [Fact]
    public async Task GetPagedAsync_returns_an_empty_page_past_the_last_record()
    {
        var service = CreateService();
        var request = ValidRequestBase();
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
        await service.CreateAsync(request);

        var page = await service.GetPagedAsync(pageIndex: 5, pageSize: 10, SortOption.RecentFirst);

        Assert.Empty(page.Items);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public async Task GetPagedAsync_sorts_by_name_when_requested()
    {
        var service = CreateService();
        foreach (var name in new[] { "Zebra", "Alfa", "Mike" })
        {
            var request = ValidRequestBase();
            request.Name = name;
            request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];
            await service.CreateAsync(request);
        }

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending);

        Assert.Equal(["Alfa", "Mike", "Zebra"], page.Items.Select(m => m.Name));
    }

    private class FakeMappingRepository : IMappingRepository
    {
        private readonly Dictionary<string, Mapping> _store = [];

        public Task<List<Mapping>> GetAllAsync() => Task.FromResult(_store.Values.ToList());

        public Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort)
        {
            IEnumerable<Mapping> ordered = sort switch
            {
                SortOption.NameAscending => _store.Values.OrderBy(m => m.Name),
                SortOption.NameDescending => _store.Values.OrderByDescending(m => m.Name),
                SortOption.OldestFirst => _store.Values.OrderBy(m => m.UpdatedAt),
                _ => _store.Values.OrderByDescending(m => m.UpdatedAt),
            };
            var list = ordered.ToList();
            var page = list.Skip(pageIndex * pageSize).Take(pageSize).ToList();
            return Task.FromResult((page, (long)list.Count));
        }

        public Task<Mapping?> GetByIdAsync(string id) => Task.FromResult(_store.GetValueOrDefault(id));

        public Task<Mapping> CreateAsync(Mapping mapping)
        {
            mapping.Id = Guid.NewGuid().ToString();
            _store[mapping.Id] = mapping;
            return Task.FromResult(mapping);
        }

        public Task<Mapping?> UpdateAsync(Mapping mapping)
        {
            if (!_store.ContainsKey(mapping.Id))
            {
                return Task.FromResult<Mapping?>(null);
            }

            _store[mapping.Id] = mapping;
            return Task.FromResult<Mapping?>(mapping);
        }

        public Task<bool> DeleteAsync(string id) => Task.FromResult(_store.Remove(id));
    }

    private class FakeSourceSchemaRepository : ISourceSchemaRepository
    {
        private readonly SourceSchema _schema = new()
        {
            Id = SchemaId,
            Name = "Test Sema",
            Fields = [new SourceField { Name = "Ad" }, new SourceField { Name = "Soyad" }, new SourceField { Name = "IBAN" }],
        };

        public Task<List<SourceSchema>> GetAllAsync() => Task.FromResult(new List<SourceSchema> { _schema });

        public Task<(List<SourceSchema> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort) =>
            Task.FromResult((new List<SourceSchema> { _schema }, 1L));

        public Task<SourceSchema?> GetByIdAsync(string id) => Task.FromResult(id == SchemaId ? _schema : null);

        public Task<SourceSchema> CreateAsync(SourceSchema s) => Task.FromResult(s);

        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);
    }

    private class FakeFileTypeRepository(List<TargetField>? targetFields = null) : IFileTypeRepository
    {
        private readonly FileType _fileType = new()
        {
            Id = FileTypeId,
            Name = "Test Dosya Tipi",
            TargetFields = targetFields ?? [new TargetField { Name = "Ad" }, new TargetField { Name = "AdSoyad" }, new TargetField { Name = "IBAN" }],
        };

        public Task<List<FileType>> GetByProductIdAsync(string productId) => Task.FromResult(new List<FileType> { _fileType });

        public Task<FileType?> GetByIdAsync(string id) => Task.FromResult(id == FileTypeId ? _fileType : null);
    }
}
