using BankMapper.Domain.Enums;

namespace BankMapper.Application.Users;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync();

    Task<UserDto?> UpdateRoleAsync(string id, UserRole role, string currentUserId);
}
