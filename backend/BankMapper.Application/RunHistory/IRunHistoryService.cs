using BankMapper.Application.Common;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.RunHistory;

public interface IRunHistoryService
{
    Task<PagedResult<MappingRunDto>> GetPagedAsync(int pageIndex, int pageSize, RunKind? kind = null, bool? success = null);
}
