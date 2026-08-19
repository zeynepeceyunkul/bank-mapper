using BankMapper.Application.Abstractions;
using BankMapper.Application.RunHistory;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using Xunit;

namespace BankMapper.Tests.RunHistory;

public class RunHistoryServiceTests
{
    [Fact]
    public async Task GetPagedAsync_returns_the_requested_page_mapped_to_dtos()
    {
        var repository = new FakeMappingRunRepository();
        for (var i = 0; i < 3; i++)
        {
            await repository.CreateAsync(new MappingRun
            {
                MappingId = "m1",
                MappingName = $"Mapping {i}",
                Kind = RunKind.Preview,
                FileNames = ["dosya.csv"],
                Success = true,
                RowCount = 5,
                RunAt = DateTime.UtcNow.AddMinutes(-i),
            });
        }

        var service = new RunHistoryService(repository);
        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 2);

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal("Mapping 0", page.Items[0].MappingName);
    }

    [Fact]
    public async Task GetPagedAsync_filters_by_kind_and_success()
    {
        var repository = new FakeMappingRunRepository();
        await repository.CreateAsync(new MappingRun { MappingId = "m1", Kind = RunKind.Preview, Success = true, RunAt = DateTime.UtcNow });
        await repository.CreateAsync(new MappingRun { MappingId = "m1", Kind = RunKind.Convert, Success = true, RunAt = DateTime.UtcNow });
        await repository.CreateAsync(new MappingRun { MappingId = "m1", Kind = RunKind.Preview, Success = false, RunAt = DateTime.UtcNow });

        var service = new RunHistoryService(repository);

        var previewOnly = await service.GetPagedAsync(0, 10, kind: RunKind.Preview);
        Assert.Equal(2, previewOnly.TotalCount);

        var failedOnly = await service.GetPagedAsync(0, 10, success: false);
        Assert.Equal(1, failedOnly.TotalCount);

        var failedPreviews = await service.GetPagedAsync(0, 10, kind: RunKind.Preview, success: false);
        Assert.Equal(1, failedPreviews.TotalCount);
    }

    private class FakeMappingRunRepository : IMappingRunRepository
    {
        private readonly List<MappingRun> _runs = [];

        public Task<MappingRun> CreateAsync(MappingRun run)
        {
            run.Id = Guid.NewGuid().ToString();
            _runs.Add(run);
            return Task.FromResult(run);
        }

        public Task<(List<MappingRun> Items, long TotalCount)> GetPagedAsync(
            int pageIndex, int pageSize, RunKind? kind = null, bool? success = null)
        {
            var filtered = _runs.AsEnumerable();
            if (kind is not null)
            {
                filtered = filtered.Where(r => r.Kind == kind.Value);
            }

            if (success is not null)
            {
                filtered = filtered.Where(r => r.Success == success.Value);
            }

            var ordered = filtered.OrderByDescending(r => r.RunAt).ToList();
            var page = ordered.Skip(pageIndex * pageSize).Take(pageSize).ToList();
            return Task.FromResult((page, (long)ordered.Count));
        }
    }
}
