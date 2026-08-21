using BankMapper.Application.Common;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.Users;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync();

    Task<PagedResult<UserDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null, UserRole? role = null);

    Task<UserDto?> UpdateRoleAsync(string id, UserRole role, string currentUserId);
}
