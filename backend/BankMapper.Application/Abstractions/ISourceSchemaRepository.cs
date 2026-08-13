using BankMapper.Application.Common;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface ISourceSchemaRepository
{
    Task<List<SourceSchema>> GetAllAsync();

    Task<(List<SourceSchema> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort);

    Task<SourceSchema?> GetByIdAsync(string id);

    Task<SourceSchema> CreateAsync(SourceSchema schema);

    Task<bool> DeleteAsync(string id);
}
