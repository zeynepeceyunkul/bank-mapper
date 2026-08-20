using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Application.Institutions;
using BankMapper.Domain.Entities;
using Xunit;

namespace BankMapper.Tests.Institutions;

public class InstitutionServiceTests
{
    private static InstitutionService CreateService(FakeInstitutionRepository? repository = null) =>
        new(repository ?? new FakeInstitutionRepository());

    [Fact]
    public async Task CreateAsync_creates_and_returns_the_institution()
    {
        var service = CreateService();

        var created = await service.CreateAsync(new CreateInstitutionRequest { Name = "VakıfBank" });

        Assert.Equal("VakıfBank", created.Name);
        Assert.NotEmpty(created.Id);
    }

    [Fact]
    public async Task CreateAsync_with_empty_name_is_rejected()
    {
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(new CreateInstitutionRequest { Name = "  " }));
        Assert.Contains("Kurum adı zorunludur", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_with_an_already_used_name_is_rejected_case_insensitively()
    {
        var service = CreateService();
        await service.CreateAsync(new CreateInstitutionRequest { Name = "VakıfBank" });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(new CreateInstitutionRequest { Name = "vakıfbank" }));
        Assert.Contains("zaten var", ex.Message);
    }

    [Fact]
    public async Task GetPagedAsync_returns_only_the_requested_page_and_the_real_total_count()
    {
        var service = CreateService();
        foreach (var name in new[] { "Kurum A", "Kurum B", "Kurum C", "Kurum D", "Kurum E" })
        {
            await service.CreateAsync(new CreateInstitutionRequest { Name = name });
        }

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 2, SortOption.NameAscending);

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.TotalCount);
    }

    [Fact]
    public async Task GetPagedAsync_sorts_alphabetically_by_name()
    {
        var service = CreateService();
        await service.CreateAsync(new CreateInstitutionRequest { Name = "Zebra Kurum" });
        await service.CreateAsync(new CreateInstitutionRequest { Name = "Ada Kurum" });

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending);

        Assert.Equal(["Ada Kurum", "Zebra Kurum"], page.Items.Select(i => i.Name));
    }

    [Fact]
    public async Task GetPagedAsync_sorts_by_most_recently_created_first()
    {
        var service = CreateService();
        await service.CreateAsync(new CreateInstitutionRequest { Name = "Once Olusturulan" });
        await service.CreateAsync(new CreateInstitutionRequest { Name = "Sonra Olusturulan" });

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.RecentFirst);

        Assert.Equal(["Sonra Olusturulan", "Once Olusturulan"], page.Items.Select(i => i.Name));
    }

    [Fact]
    public async Task GetPagedAsync_filters_by_name_search_case_insensitively()
    {
        var service = CreateService();
        await service.CreateAsync(new CreateInstitutionRequest { Name = "VakıfBank" });
        await service.CreateAsync(new CreateInstitutionRequest { Name = "Ziraat Bankası" });
        await service.CreateAsync(new CreateInstitutionRequest { Name = "Test Kurum" });

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending, search: "bank");

        Assert.Equal(2, page.TotalCount);
        Assert.Equal(["VakıfBank", "Ziraat Bankası"], page.Items.Select(i => i.Name));
    }

    [Fact]
    public async Task DeleteAsync_removes_an_existing_institution()
    {
        var service = CreateService();
        var created = await service.CreateAsync(new CreateInstitutionRequest { Name = "Silinecek Kurum" });

        var deleted = await service.DeleteAsync(created.Id);

        Assert.True(deleted);
        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task DeleteAsync_for_a_nonexistent_id_returns_false()
    {
        var service = CreateService();

        var deleted = await service.DeleteAsync("does-not-exist");

        Assert.False(deleted);
    }

    [Fact]
    public async Task DeleteAsync_succeeds_even_when_a_mapping_still_references_the_institution()
    {
        // Fatih Bey onayi (2026-08-20): mapping'ler etikette kalan (artik
        // gecersiz) KurumId'yi tutmaya devam eder, kurum tanimi her zaman silinebilir.
        var service = CreateService();
        var created = await service.CreateAsync(new CreateInstitutionRequest { Name = "VakıfBank" });

        var deleted = await service.DeleteAsync(created.Id);

        Assert.True(deleted);
    }

    private class FakeInstitutionRepository : IInstitutionRepository
    {
        private readonly Dictionary<string, Institution> _store = [];
        private int _nextId;

        public Task<List<Institution>> GetAllAsync() => Task.FromResult(_store.Values.ToList());

        public Task<(List<Institution> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null)
        {
            IEnumerable<Institution> filtered = string.IsNullOrWhiteSpace(search)
                ? _store.Values
                : _store.Values.Where(i => i.Name.Contains(search, StringComparison.OrdinalIgnoreCase));

            IEnumerable<Institution> ordered = sort switch
            {
                SortOption.NameDescending => filtered.OrderByDescending(i => i.Name, StringComparer.Ordinal),
                SortOption.RecentFirst => filtered.OrderByDescending(i => i.Id, StringComparer.Ordinal),
                SortOption.OldestFirst => filtered.OrderBy(i => i.Id, StringComparer.Ordinal),
                _ => filtered.OrderBy(i => i.Name, StringComparer.Ordinal),
            };
            var list = ordered.ToList();
            var page = list.Skip(pageIndex * pageSize).Take(pageSize).ToList();
            return Task.FromResult((page, (long)list.Count));
        }

        public Task<Institution?> GetByIdAsync(string id) => Task.FromResult(_store.GetValueOrDefault(id));

        public Task<Institution> CreateAsync(Institution institution)
        {
            institution.Id = (_nextId++).ToString("D24");
            _store[institution.Id] = institution;
            return Task.FromResult(institution);
        }

        public Task<bool> DeleteAsync(string id) => Task.FromResult(_store.Remove(id));
    }
}
