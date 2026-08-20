using BankMapper.Application.Common;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.Mappings;

public interface IMappingService
{
    Task<List<MappingDto>> GetAllAsync(MappingStatus? status = null, string? kurumId = null);

    Task<PagedResult<MappingDto>> GetPagedAsync(
        int pageIndex, int pageSize, SortOption sort, string? search = null, MappingStatus? status = null, string? kurumId = null);

    Task<MappingDto?> GetByIdAsync(string id);

    Task<MappingDto> CreateAsync(CreateMappingRequest request, string? createdBy = null);

    Task<MappingDto?> UpdateAsync(string id, CreateMappingRequest request);

    Task<bool> DeleteAsync(string id);

    Task<MappingDto?> ApproveAsync(string id, string? approvedBy);

    Task<MappingDto?> RejectAsync(string id, string reason, string? rejectedBy);
}
