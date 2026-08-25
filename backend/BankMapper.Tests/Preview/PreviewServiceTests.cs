using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
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
    private const string FileTypeId = "ft1";

    private static MappingExecutor CreateExecutor() => new(new FunctoidRegistry([new TrimFunctoid()]));

    private static (PreviewService Service, FakeMappingRunRepository RunRepo) CreateService(
        Mapping mapping,
        Dictionary<string, SourceSchema> schemas,
        Dictionary<string, List<Dictionary<string, string?>>> rowsBySchemaId)
    {
        var mappingRepo = new FakeMappingRepository(mapping);
        var schemaRepo = new FakeSourceSchemaRepository(schemas);
        var fileTypeRepo = new FakeFileTypeRepository(FileType());
        var parserFactory = new FakeFileParserFactory(new FakeFileParser(rowsBySchemaId));
        var writerFactory = new FileWriterFactory();
        var runRepo = new FakeMappingRunRepository();
        var service = new PreviewService(
            mappingRepo, schemaRepo, fileTypeRepo, parserFactory, CreateExecutor(), writerFactory, runRepo, NullLogger<PreviewService>.Instance);
        return (service, runRepo);
    }

    private static SourceSchema Schema(string id) => new() { Id = id, Name = id, FileFormat = FileFormat.Csv };

    private static Domain.Entities.FileType FileType() => new()
    {
        Id = FileTypeId,
        Name = "Test Dosya Tipi",
        TargetFields = [new TargetField { Name = "AdOut" }],
    };

    private static List<PreviewSourceFile> FilesFor(params string[] schemaIds) =>
        schemaIds.Select(id => new PreviewSourceFile { SourceSchemaId = id, Content = Stream.Null, FileName = $"{id}.csv" }).ToList();

    [Fact]
    public async Task Single_schema_mapping_maps_fields_directly()
    {
        var mapping = new Mapping
        {
            Id = "m1",
            Status = MappingStatus.Approved,
            SourceSchemas = [new MappingSourceSchema { SourceSchemaId = SchemaA, Alias = "A" }],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaA, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "AdOut" },
            ],
        };

        var (service, runRepo) = CreateService(
            mapping,
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA) },
            new Dictionary<string, List<Dictionary<string, string?>>> { [SchemaA] = [Row(("Ad", "Ahmet"))] });

        var result = await service.ExecuteAsync("m1", FilesFor(SchemaA));

        Assert.Single(result.Rows);
        Assert.Equal("Ahmet", result.Rows[0]["AdOut"]);
        Assert.Empty(result.Warnings);

        var run = Assert.Single(runRepo.Runs);
        Assert.Equal("m1", run.MappingId);
        Assert.Equal(RunKind.Preview, run.Kind);
        Assert.True(run.Success);
        Assert.Equal(1, run.RowCount);
        Assert.Null(run.ErrorMessage);
        Assert.Equal(["A.csv"], run.FileNames);
    }

    [Fact]
    public async Task ExecuteAsync_rejects_a_mapping_that_is_not_approved()
    {
        var mapping = new Mapping
        {
            Id = "m1",
            Status = MappingStatus.PendingApproval,
            SourceSchemas = [new MappingSourceSchema { SourceSchemaId = SchemaA, Alias = "A" }],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaA, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "AdOut" },
            ],
        };

        var (service, _) = CreateService(
            mapping,
            new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA) },
            new Dictionary<string, List<Dictionary<string, string?>>> { [SchemaA] = [Row(("Ad", "Ahmet"))] });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.ExecuteAsync("m1", FilesFor(SchemaA)));
        Assert.Contains("henuz onaylanmadi", ex.Message);
    }

    [Fact]
    public async Task Parser_exception_from_an_invalid_file_is_converted_to_a_clear_argument_exception()
    {
        var mapping = new Mapping
        {
            Id = "m1",
            Status = MappingStatus.Approved,
            SourceSchemas = [new MappingSourceSchema { SourceSchemaId = SchemaA, Alias = "A" }],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaA, FromFieldName = "Ad", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "AdOut" },
            ],
        };

        var mappingRepo = new FakeMappingRepository(mapping);
        var schemaRepo = new FakeSourceSchemaRepository(new Dictionary<string, SourceSchema> { [SchemaA] = Schema(SchemaA) });
        var fileTypeRepo = new FakeFileTypeRepository(FileType());
        var parserFactory = new FakeFileParserFactory(new FakeThrowingFileParser());
        var writerFactory = new FileWriterFactory();
        var runRepo = new FakeMappingRunRepository();
        var service = new PreviewService(
            mappingRepo, schemaRepo, fileTypeRepo, parserFactory, CreateExecutor(), writerFactory, runRepo, NullLogger<PreviewService>.Instance);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.ExecuteAsync("m1", FilesFor(SchemaA)));

        Assert.Contains("A", ex.Message);
        Assert.IsType<InvalidDataException>(ex.InnerException);

        var run = Assert.Single(runRepo.Runs);
        Assert.False(run.Success);
        Assert.Equal(ex.Message, run.ErrorMessage);
        Assert.Null(run.RowCount);
    }

    private static Dictionary<string, string?> Row(params (string Key, string? Value)[] fields) =>
        fields.ToDictionary(f => f.Key, f => f.Value);

    private class FakeMappingRepository(Mapping mapping) : IMappingRepository
    {
        public Task<List<Mapping>> GetAllAsync(MappingStatus? status = null, string? kurumId = null) => Task.FromResult(new List<Mapping> { mapping });

        public Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(
            int pageIndex, int pageSize, SortOption sort, string? search = null, MappingStatus? status = null,
            string? kurumId = null, string? createdBy = null) =>
            Task.FromResult((new List<Mapping> { mapping }, 1L));

        public Task<Mapping?> GetByIdAsync(string id) => Task.FromResult<Mapping?>(id == mapping.Id ? mapping : null);

        public Task<Mapping> CreateAsync(Mapping m) => Task.FromResult(m);

        public Task<Mapping?> UpdateAsync(Mapping m) => Task.FromResult<Mapping?>(m);

        public Task<Mapping?> UpdateIfStatusAsync(Mapping m, MappingStatus expectedCurrentStatus) => Task.FromResult<Mapping?>(m);

        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);
    }

    private class FakeSourceSchemaRepository(Dictionary<string, SourceSchema> schemas) : ISourceSchemaRepository
    {
        public Task<List<SourceSchema>> GetAllAsync() => Task.FromResult(schemas.Values.ToList());

        public Task<(List<SourceSchema> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null) =>
            Task.FromResult((schemas.Values.ToList(), (long)schemas.Count));

        public Task<SourceSchema?> GetByIdAsync(string id) => Task.FromResult(schemas.GetValueOrDefault(id));

        public Task<SourceSchema> CreateAsync(SourceSchema s) => Task.FromResult(s);

        public Task<bool> DeleteAsync(string id) => Task.FromResult(schemas.Remove(id));
    }

    private class FakeFileTypeRepository(Domain.Entities.FileType fileType) : IFileTypeRepository
    {
        public Task<List<Domain.Entities.FileType>> GetByProductIdAsync(string productId) =>
            Task.FromResult(new List<Domain.Entities.FileType> { fileType });

        public Task<Domain.Entities.FileType?> GetByIdAsync(string id) => Task.FromResult<Domain.Entities.FileType?>(fileType);
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

    private class FakeMappingRunRepository : IMappingRunRepository
    {
        public List<MappingRun> Runs { get; } = [];

        public Task<MappingRun> CreateAsync(MappingRun run)
        {
            run.Id = Guid.NewGuid().ToString();
            Runs.Add(run);
            return Task.FromResult(run);
        }

        public Task<(List<MappingRun> Items, long TotalCount)> GetPagedAsync(
            int pageIndex, int pageSize, RunKind? kind = null, bool? success = null) =>
            Task.FromResult((Runs.OrderByDescending(r => r.RunAt).ToList(), (long)Runs.Count));
    }
}
