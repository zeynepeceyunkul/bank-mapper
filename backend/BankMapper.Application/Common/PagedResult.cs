namespace BankMapper.Application.Common;

public class PagedResult<T>
{
    public List<T> Items { get; set; } = [];

    public long TotalCount { get; set; }
}
