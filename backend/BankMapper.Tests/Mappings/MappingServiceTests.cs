using BankMapper.Application.Abstractions;
using BankMapper.Application.Mappings;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using Xunit;

namespace BankMapper.Tests.Mappings;

public class MappingServiceTests
{
    private const string SchemaId = "src1";

    private static MappingService CreateService() => new(new FakeMappingRepository());

    private static CreateMappingRequest ValidRequestBase() => new()
    {
        Name = "Test Mapping",
        FileTypeId = "ft1",
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
    public async Task Multiple_source_schemas_without_join_key_are_rejected()
    {
        var request = ValidRequestBase();
        request.SourceSchemas =
        [
            new MappingSourceSchemaDto { SourceSchemaId = "src1", Alias = "A" },
            new MappingSourceSchemaDto { SourceSchemaId = "src2", Alias = "B" },
        ];
        request.Edges = [new GraphEdgeDto { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = "src1", FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Ad" }];

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => CreateService().CreateAsync(request));
        Assert.Contains("birleştirme anahtarı", ex.Message);
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

    private class FakeMappingRepository : IMappingRepository
    {
        private readonly Dictionary<string, Mapping> _store = [];

        public Task<List<Mapping>> GetAllAsync() => Task.FromResult(_store.Values.ToList());

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
    }
}
