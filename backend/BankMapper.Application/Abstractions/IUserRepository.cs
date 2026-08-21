using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.Abstractions;

public interface IUserRepository
{
    Task<List<User>> GetAllAsync();

    Task<(List<User> Items, long TotalCount)> GetPagedAsync(
        int pageIndex, int pageSize, SortOption sort, string? search = null, UserRole? role = null);

    Task<User?> GetByEmailAsync(string email);

    Task<User?> GetByIdAsync(string id);

    Task<User> CreateAsync(User user);

    Task UpdateAsync(User user);
}
