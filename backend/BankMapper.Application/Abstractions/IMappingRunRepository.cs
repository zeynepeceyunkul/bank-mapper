using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.Abstractions;

public interface IMappingRunRepository
{
    Task<MappingRun> CreateAsync(MappingRun run);

    Task<(List<MappingRun> Items, long TotalCount)> GetPagedAsync(
        int pageIndex, int pageSize, RunKind? kind = null, bool? success = null);
}
