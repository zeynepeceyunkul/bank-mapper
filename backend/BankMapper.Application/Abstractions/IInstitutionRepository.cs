using BankMapper.Application.Common;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IInstitutionRepository
{
    Task<List<Institution>> GetAllAsync();

    Task<(List<Institution> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null);

    Task<Institution?> GetByIdAsync(string id);

    Task<Institution> CreateAsync(Institution institution);

    Task<bool> DeleteAsync(string id);
}
