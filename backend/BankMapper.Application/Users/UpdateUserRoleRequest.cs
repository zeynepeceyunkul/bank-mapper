using BankMapper.Domain.Enums;

namespace BankMapper.Application.Users;

public class UpdateUserRoleRequest
{
    public UserRole Role { get; set; }
}
