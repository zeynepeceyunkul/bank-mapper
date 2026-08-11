using BankMapper.Application.Common;

namespace BankMapper.Application.SourceSchemas;

public interface ISourceSchemaService
{
    Task<List<SourceSchemaDto>> GetAllAsync();

    Task<PagedResult<SourceSchemaDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort);

    Task<SourceSchemaDto> CreateAsync(CreateSourceSchemaRequest request);

    Task<bool> DeleteAsync(string id);
}
