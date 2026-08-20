using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.Institutions;

public class InstitutionService(IInstitutionRepository repository) : IInstitutionService
{
    public async Task<List<InstitutionDto>> GetAllAsync()
    {
        var institutions = await repository.GetAllAsync();
        return institutions.Select(ToDto).ToList();
    }

    public async Task<PagedResult<InstitutionDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null)
    {
        var clampedPageIndex = Math.Max(pageIndex, 0);
        var clampedPageSize = Math.Clamp(pageSize, 1, 100);

        var (items, totalCount) = await repository.GetPagedAsync(clampedPageIndex, clampedPageSize, sort, search);
        return new PagedResult<InstitutionDto> { Items = items.Select(ToDto).ToList(), TotalCount = totalCount };
    }

    public async Task<InstitutionDto> CreateAsync(CreateInstitutionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Kurum adı zorunludur.");
        }

        var name = request.Name.Trim();

        // SourceSchema'nin aksine (ayni isimde otomatik " (1)" eklenir) burada
        // sessizce yeniden adlandirmiyoruz, direkt reddediyoruz - Kurum bir
        // filtre etiketi, iki tane ayni isimde "VakifBank" olursa filtrelemenin
        // anlami kalmaz (bkz. MappingService.ValidateAsync'teki ayni mapping-adi
        // cakismasi kontrolu, ayni gerekce).
        var existingNames = (await repository.GetAllAsync())
            .Select(i => i.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (existingNames.Contains(name))
        {
            throw new ArgumentException($"Bu isimde bir kurum zaten var: {name}");
        }

        var institution = new Institution { Name = name };
        var created = await repository.CreateAsync(institution);
        return ToDto(created);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var existing = await repository.GetByIdAsync(id);
        if (existing is null)
        {
            return false;
        }

        // Fatih Bey onayi (2026-08-20): kurum tanimi her zaman silinebilir,
        // mapping'ler etikette kalan (artik gecersiz) KurumId'yi tutmaya devam
        // eder - bir mapping zaten birden fazla kurum tarafindan kullanilabildigi
        // icin bu kasitli, guard yok.
        return await repository.DeleteAsync(id);
    }

    private static InstitutionDto ToDto(Institution institution) => new()
    {
        Id = institution.Id,
        Name = institution.Name
    };
}
