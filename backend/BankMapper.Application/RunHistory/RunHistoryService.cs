using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.RunHistory;

public class RunHistoryService(IMappingRunRepository repository) : IRunHistoryService
{
    public async Task<PagedResult<MappingRunDto>> GetPagedAsync(int pageIndex, int pageSize, RunKind? kind = null, bool? success = null)
    {
        var clampedPageIndex = Math.Max(pageIndex, 0);
        var clampedPageSize = Math.Clamp(pageSize, 1, 100);

        var (items, totalCount) = await repository.GetPagedAsync(clampedPageIndex, clampedPageSize, kind, success);
        return new PagedResult<MappingRunDto> { Items = items.Select(ToDto).ToList(), TotalCount = totalCount };
    }

    private static MappingRunDto ToDto(MappingRun run) => new()
    {
        Id = run.Id,
        MappingId = run.MappingId,
        MappingName = run.MappingName,
        Kind = run.Kind,
        FileNames = run.FileNames,
        Success = run.Success,
        RowCount = run.RowCount,
        ErrorMessage = run.ErrorMessage,
        RunAt = run.RunAt,
    };
}
