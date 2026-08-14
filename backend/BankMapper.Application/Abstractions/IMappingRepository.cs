using BankMapper.Application.Common;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IMappingRepository
{
    Task<List<Mapping>> GetAllAsync();

    Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null);

    Task<Mapping?> GetByIdAsync(string id);

    Task<Mapping> CreateAsync(Mapping mapping);

    Task<Mapping?> UpdateAsync(Mapping mapping);

    Task<bool> DeleteAsync(string id);
}
