using BankMapper.Application.Common;

namespace BankMapper.Application.Mappings;

public interface IMappingService
{
    Task<List<MappingDto>> GetAllAsync();

    Task<PagedResult<MappingDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort);

    Task<MappingDto?> GetByIdAsync(string id);

    Task<MappingDto> CreateAsync(CreateMappingRequest request);

    Task<MappingDto?> UpdateAsync(string id, CreateMappingRequest request);

    Task<bool> DeleteAsync(string id);
}
