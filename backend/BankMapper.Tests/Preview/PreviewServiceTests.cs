using BankMapper.Application.Abstractions;
using BankMapper.Application.FileParsing;
using BankMapper.Application.Preview;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;
using BankMapper.Domain.Functoids;
using Xunit;

namespace BankMapper.Tests.Preview;

public class PreviewServiceTests
{
    private const string SchemaA = "A";
    private const string SchemaB = "B";

    private static MappingExecutor CreateExecutor() => new(new FunctoidRegistry([new TrimFunctoid()]));

    private static PreviewService CreateService(
        Mapping mapping,
        Dictionary<string, SourceSchema> schemas,
        Dictionary<string, List<Dictionary<string, string?>>> rowsBySchemaId)
    {
        var mappingRepo = new FakeMappingRepository(mapping);
        var schemaRepo = new FakeSourceSchemaRepository(schemas);
        var parserFactory = new FakeFileParserFactory(new FakeFileParser(rowsBySchemaId));
        return new PreviewService(mappingRepo, schemaRepo, parserFactory, CreateExecutor());
    }

    private static SourceSchema Schema(string id) => new() { Id = id, Name = id, FileFormat = FileFormat.Csv };

    private static List<PreviewSourceFile> FilesFor(params string[] schemaIds) =>
        schemaIds.Select(id => new PreviewSourceFile { SourceSchemaId = id, Content = Stream.Null }).ToList();

    [Fact]
    public async Task Single_schema_mapping_bypasses_join_and_maps_fields_directly()
    {
        var mapping = new Mapping
        {
            Id = "m1",
            SourceSchemas = [new MappingSourceSchema { SourceSchemaId = SchemaA, Alias = "A" }],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaA, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "AdOut" },
            ],
        };

        var service = CreateService(
            mapping,
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA) },
            new Dictionary<string, List<Dictionary<string, string?>>> { [SchemaA] = [Row(("Ad", "Ahmet"))] });

        var result = await service.ExecuteAsync("m1", FilesFor(SchemaA));

        Assert.Single(result.Rows);
        Assert.Equal("Ahmet", result.Rows[0]["AdOut"]);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public async Task Two_schemas_are_inner_joined_by_key_and_merged_into_one_row()
    {
        var service = CreateService(
            TwoSchemaMapping(),
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA), [SchemaB] = Schema(SchemaB) },
            new Dictionary<string, List<Dictionary<string, string?>>>
            {
                [SchemaA] = [Row(("Id", "1"), ("NameA", "Ahmet")), Row(("Id", "2"), ("NameA", "Mehmet"))],
                [SchemaB] = [Row(("Id", "1"), ("NameB", "Yilmaz")), Row(("Id", "2"), ("NameB", "Demir"))],
            });

        var result = await service.ExecuteAsync("m1", FilesFor(SchemaA, SchemaB));

        Assert.Equal(2, result.Rows.Count);
        Assert.Contains(result.Rows, r => (string?)r["OutA"] == "Ahmet" && (string?)r["OutB"] == "Yilmaz");
        Assert.Contains(result.Rows, r => (string?)r["OutA"] == "Mehmet" && (string?)r["OutB"] == "Demir");
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public async Task Unmatched_key_in_secondary_schema_is_skipped_with_a_warning()
    {
        var service = CreateService(
            TwoSchemaMapping(),
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA), [SchemaB] = Schema(SchemaB) },
            new Dictionary<string, List<Dictionary<string, string?>>>
            {
                [SchemaA] = [Row(("Id", "1"), ("NameA", "Ahmet")), Row(("Id", "2"), ("NameA", "Mehmet"))],
                [SchemaB] = [Row(("Id", "1"), ("NameB", "Yilmaz"))],
            });

        var result = await service.ExecuteAsync("m1", FilesFor(SchemaA, SchemaB));

        Assert.Single(result.Rows);
        Assert.Equal("Ahmet", result.Rows[0]["OutA"]);
        Assert.Contains(result.Warnings, w => w.Contains('2') && w.Contains('B'));
    }

    [Fact]
    public async Task Duplicate_join_key_within_one_schema_keeps_the_last_row()
    {
        var service = CreateService(
            TwoSchemaMapping(),
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA), [SchemaB] = Schema(SchemaB) },
            new Dictionary<string, List<Dictionary<string, string?>>>
            {
                [SchemaA] = [Row(("Id", "1"), ("NameA", "Birinci")), Row(("Id", "1"), ("NameA", "Ikinci"))],
                [SchemaB] = [Row(("Id", "1"), ("NameB", "Yilmaz"))],
            });

        var result = await service.ExecuteAsync("m1", FilesFor(SchemaA, SchemaB));

        Assert.Single(result.Rows);
        Assert.Equal("Ikinci", result.Rows[0]["OutA"]);
    }

    [Fact]
    public async Task Empty_join_key_value_is_skipped_with_a_warning()
    {
        var service = CreateService(
            TwoSchemaMapping(),
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA), [SchemaB] = Schema(SchemaB) },
            new Dictionary<string, List<Dictionary<string, string?>>>
            {
                [SchemaA] = [Row(("Id", ""), ("NameA", "Hayalet")), Row(("Id", "1"), ("NameA", "Ahmet"))],
                [SchemaB] = [Row(("Id", "1"), ("NameB", "Yilmaz"))],
            });

        var result = await service.ExecuteAsync("m1", FilesFor(SchemaA, SchemaB));

        Assert.Single(result.Rows);
        Assert.Equal("Ahmet", result.Rows[0]["OutA"]);
        Assert.Contains(result.Warnings, w => w.Contains('A') && w.Contains("boş"));
    }

    private static Mapping TwoSchemaMapping() => new()
    {
        Id = "m1",
        SourceSchemas =
        [
            new MappingSourceSchema { SourceSchemaId = SchemaA, Alias = "A", JoinKeyField = "Id" },
            new MappingSourceSchema { SourceSchemaId = SchemaB, Alias = "B", JoinKeyField = "Id" },
        ],
        Edges =
        [
            new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaA, FromFieldName = "NameA", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "OutA" },
            new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaB, FromFieldName = "NameB", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "OutB" },
        ],
    };

    private static Dictionary<string, string?> Row(params (string Key, string? Value)[] fields) =>
        fields.ToDictionary(f => f.Key, f => f.Value);

    private class FakeMappingRepository(Mapping mapping) : IMappingRepository
    {
        public Task<List<Mapping>> GetAllAsync() => Task.FromResult(new List<Mapping> { mapping });

        public Task<Mapping?> GetByIdAsync(string id) => Task.FromResult<Mapping?>(id == mapping.Id ? mapping : null);

        public Task<Mapping> CreateAsync(Mapping m) => Task.FromResult(m);

        public Task<Mapping?> UpdateAsync(Mapping m) => Task.FromResult<Mapping?>(m);
    }

    private class FakeSourceSchemaRepository(Dictionary<string, SourceSchema> schemas) : ISourceSchemaRepository
    {
        public Task<List<SourceSchema>> GetAllAsync() => Task.FromResult(schemas.Values.ToList());

        public Task<SourceSchema?> GetByIdAsync(string id) => Task.FromResult(schemas.GetValueOrDefault(id));

        public Task<SourceSchema> CreateAsync(SourceSchema s) => Task.FromResult(s);
    }

    private class FakeFileParser(Dictionary<string, List<Dictionary<string, string?>>> rowsBySchemaId) : IFileParser
    {
        public ParsedFileResult Parse(Stream fileStream, SourceSchema schema) => new() { Rows = rowsBySchemaId[schema.Id] };
    }

    private class FakeFileParserFactory(IFileParser parser) : IFileParserFactory
    {
        public IFileParser GetParser(FileFormat format) => parser;
    }
}
