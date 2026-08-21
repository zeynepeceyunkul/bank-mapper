using BankMapper.Application.Common;

namespace BankMapper.Application.Institutions;

public interface IInstitutionService
{
    Task<List<InstitutionDto>> GetAllAsync();

    Task<PagedResult<InstitutionDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null);

    Task<InstitutionDto> CreateAsync(CreateInstitutionRequest request);

    Task<bool> DeleteAsync(string id);
}
