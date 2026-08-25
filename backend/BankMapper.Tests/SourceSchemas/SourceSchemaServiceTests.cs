using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Application.FileParsing;
using BankMapper.Application.SourceSchemas;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using Xunit;

namespace BankMapper.Tests.SourceSchemas;

public class SourceSchemaServiceTests
{
    private static SourceSchemaService CreateService(FakeSourceSchemaRepository? repository = null) =>
        new(repository ?? new FakeSourceSchemaRepository(), new FakeFileParserFactory(), new FakeMappingRepository());

    private static CreateSourceSchemaRequest FixedLengthRequest(string name) => new()
    {
        Name = name,
        FileFormat = FileFormat.FixedLength,
        HasHeader = false,
        Fields = [new SourceFieldDto { Name = "Ad", Type = "string", Order = 1, StartIndex = 0, Length = 10 }],
    };

    [Fact]
    public async Task GetPagedAsync_returns_only_the_requested_page_and_the_real_total_count()
    {
        var service = CreateService();
        foreach (var name in new[] { "Sema A", "Sema B", "Sema C", "Sema D", "Sema E" })
        {
            await service.CreateAsync(FixedLengthRequest(name));
        }

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 2, SortOption.NameAscending);

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.TotalCount);
    }

    [Fact]
    public async Task GetPagedAsync_sorts_alphabetically_by_name()
    {
        var service = CreateService();
        await service.CreateAsync(FixedLengthRequest("Zebra Sema"));
        await service.CreateAsync(FixedLengthRequest("Ada Sema"));

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending);

        Assert.Equal(["Ada Sema", "Zebra Sema"], page.Items.Select(s => s.Name));
    }

    [Fact]
    public async Task GetPagedAsync_sorts_by_most_recently_created_first()
    {
        // Gercek Mongo'da bunun karsiligi ObjectId'nin (_id) kendisi - burada
        // fake, ayni "kronolojik olarak siralanabilir id" ozelligini taklit
        // etmek icin Guid yerine artan bir sayac kullaniyor (bkz. FakeSourceSchemaRepository).
        var service = CreateService();
        await service.CreateAsync(FixedLengthRequest("Once Olusturulan"));
        await service.CreateAsync(FixedLengthRequest("Sonra Olusturulan"));

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.RecentFirst);

        Assert.Equal(["Sonra Olusturulan", "Once Olusturulan"], page.Items.Select(s => s.Name));
    }

    [Fact]
    public async Task GetPagedAsync_returns_an_empty_page_past_the_last_record()
    {
        var service = CreateService();
        await service.CreateAsync(FixedLengthRequest("Tek Sema"));

        var page = await service.GetPagedAsync(pageIndex: 5, pageSize: 10, SortOption.NameAscending);

        Assert.Empty(page.Items);
        Assert.Equal(1, page.TotalCount);
    }
 
    [Fact]
    public async Task GetPagedAsync_filters_by_name_search_case_insensitively()
    {
        var service = CreateService();
        await service.CreateAsync(FixedLengthRequest("Musteri X Bordro CSV"));
        await service.CreateAsync(FixedLengthRequest("Musteri Y Bordro Excel"));
        await service.CreateAsync(FixedLengthRequest("Test Sema"));

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending, search: "bordro");

        Assert.Equal(2, page.TotalCount);
        Assert.Equal(["Musteri X Bordro CSV", "Musteri Y Bordro Excel"], page.Items.Select(s => s.Name));
    }

    [Fact]
    public async Task Invalid_file_during_field_detection_throws_a_clear_error_instead_of_leaking_the_parsers_own_exception()
    {
        // PreviewService.RunMappingAsync'deki ayni korumanin sema OLUSTURMA
        // yolundaki eslenigi - ClosedXML/CsvHelper gecersiz bir dosyada kendi
        // ic exception tipini (burada simule edilen InvalidDataException)
        // firlatiyor, bu yakalanip acik bir ArgumentException'a cevrilmeli
        // (aksi halde GlobalExceptionHandler bunu yanlislikla "Gecersiz id
        // formati" olarak yorumluyordu).
        var service = new SourceSchemaService(
            new FakeSourceSchemaRepository(), new FakeThrowingFileParserFactory(), new FakeMappingRepository());

        var request = new CreateSourceSchemaRequest
        {
            Name = "Gecersiz Dosya",
            FileFormat = FileFormat.Excel,
            HasHeader = true,
            File = new MemoryStream([1, 2, 3]),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request));
        Assert.Contains("geçerli bir", ex.Message);
        Assert.IsType<InvalidDataException>(ex.InnerException);
    }

    private class FakeSourceSchemaRepository : ISourceSchemaRepository
    {
        private readonly Dictionary<string, SourceSchema> _store = [];
        private int _nextId;

        public Task<List<SourceSchema>> GetAllAsync() => Task.FromResult(_store.Values.ToList());

        public Task<(List<SourceSchema> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null)
        {
            IEnumerable<SourceSchema> filtered = string.IsNullOrWhiteSpace(search)
                ? _store.Values
                : _store.Values.Where(s => s.Name.Contains(search, StringComparison.OrdinalIgnoreCase));

            IEnumerable<SourceSchema> ordered = sort switch
            {
                SortOption.NameDescending => filtered.OrderByDescending(s => s.Name, StringComparer.Ordinal),
                SortOption.RecentFirst => filtered.OrderByDescending(s => s.Id, StringComparer.Ordinal),
                SortOption.OldestFirst => filtered.OrderBy(s => s.Id, StringComparer.Ordinal),
                _ => filtered.OrderBy(s => s.Name, StringComparer.Ordinal),
            };
            var list = ordered.ToList();
            var page = list.Skip(pageIndex * pageSize).Take(pageSize).ToList();
            return Task.FromResult((page, (long)list.Count));
        }

        public Task<SourceSchema?> GetByIdAsync(string id) => Task.FromResult(_store.GetValueOrDefault(id));

        public Task<SourceSchema> CreateAsync(SourceSchema schema)
        {
            // Gercek Mongo ObjectId'si zaman damgasini basinda tasidigi icin
            // string olarak da kronolojik sirali - burada ayni ozelligi artan,
            // sabit uzunlukta sifir dolgulu bir sayacla taklit ediyoruz (rastgele
            // bir Guid bu sirayi koruyamazdi).
            schema.Id = (_nextId++).ToString("D24");
            _store[schema.Id] = schema;
            return Task.FromResult(schema);
        }

        public Task<bool> DeleteAsync(string id) => Task.FromResult(_store.Remove(id));
    }

    private class FakeFileParserFactory : IFileParserFactory
    {
        public IFileParser GetParser(FileFormat format) => throw new NotImplementedException("Bu testlerde FixedLength kullanilip parser hic cagrilmiyor.");
    }

    private class FakeThrowingFileParserFactory : IFileParserFactory
    {
        public IFileParser GetParser(FileFormat format) => new FakeThrowingFileParser();
    }

    private class FakeThrowingFileParser : IFileParser
    {
        public ParsedFileResult Parse(Stream fileStream, SourceSchema schema) =>
            throw new InvalidDataException("Gecersiz dosya icerigi (simule edildi)");
    }

    private class FakeMappingRepository : IMappingRepository
    {
        public Task<List<Mapping>> GetAllAsync(MappingStatus? status = null, string? kurumId = null) => Task.FromResult(new List<Mapping>());
        public Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null, MappingStatus? status = null, string? kurumId = null, string? createdBy = null) => Task.FromResult((new List<Mapping>(), 0L));
        public Task<Mapping?> GetByIdAsync(string id) => Task.FromResult<Mapping?>(null);
        public Task<Mapping> CreateAsync(Mapping mapping) => Task.FromResult(mapping);
        public Task<Mapping?> UpdateAsync(Mapping mapping) => Task.FromResult<Mapping?>(null);
        public Task<Mapping?> UpdateIfStatusAsync(Mapping mapping, MappingStatus expectedCurrentStatus) => Task.FromResult<Mapping?>(null);
        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);
    }
}
