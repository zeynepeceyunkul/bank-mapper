using BankMapper.Application.Abstractions;
using BankMapper.Application.FileParsing;
using BankMapper.Application.Preview;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;
using BankMapper.Domain.Functoids;
using BankMapper.Infrastructure.FileWriting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BankMapper.Tests.Preview;

public class PreviewServiceTests
{
    private const string SchemaA = "A";

    private static MappingExecutor CreateExecutor() => new(new FunctoidRegistry([new TrimFunctoid()]));

    private static PreviewService CreateService(
        Mapping mapping,
        Dictionary<string, SourceSchema> schemas,
        Dictionary<string, List<Dictionary<string, string?>>> rowsBySchemaId)
    {
        var mappingRepo = new FakeMappingRepository(mapping);
        var schemaRepo = new FakeSourceSchemaRepository(schemas);
        var parserFactory = new FakeFileParserFactory(new FakeFileParser(rowsBySchemaId));
        var writerFactory = new FileWriterFactory();
        return new PreviewService(mappingRepo, schemaRepo, parserFactory, CreateExecutor(), writerFactory, NullLogger<PreviewService>.Instance);
    }

    private static SourceSchema Schema(string id) => new() { Id = id, Name = id, FileFormat = FileFormat.Csv };

    private static List<PreviewSourceFile> FilesFor(params string[] schemaIds) =>
        schemaIds.Select(id => new PreviewSourceFile { SourceSchemaId = id, Content = Stream.Null }).ToList();

    [Fact]
    public async Task Single_schema_mapping_maps_fields_directly()
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
    public async Task Parser_exception_from_an_invalid_file_is_converted_to_a_clear_argument_exception()
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

        var mappingRepo = new FakeMappingRepository(mapping);
        var schemaRepo = new FakeSourceSchemaRepository(new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA) });
        var parserFactory = new FakeFileParserFactory(new FakeThrowingFileParser());
        var writerFactory = new FileWriterFactory();
        var service = new PreviewService(mappingRepo, schemaRepo, parserFactory, CreateExecutor(), writerFactory, NullLogger<PreviewService>.Instance);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.ExecuteAsync("m1", FilesFor(SchemaA)));

        Assert.Contains("A", ex.Message);
        Assert.IsType<InvalidDataException>(ex.InnerException);
    }

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

        public Task<bool> DeleteAsync(string id) => Task.FromResult(schemas.Remove(id));
    }

    private class FakeFileParser(Dictionary<string, List<Dictionary<string, string?>>> rowsBySchemaId) : IFileParser
    {
        public ParsedFileResult Parse(Stream fileStream, SourceSchema schema) => new() { Rows = rowsBySchemaId[schema.Id] };
    }

    private class FakeFileParserFactory(IFileParser parser) : IFileParserFactory
    {
        public IFileParser GetParser(FileFormat format) => parser;
    }

    private class FakeThrowingFileParser : IFileParser
    {
        public ParsedFileResult Parse(Stream fileStream, SourceSchema schema) =>
            throw new InvalidDataException("Gecersiz dosya icerigi");
    }
}
