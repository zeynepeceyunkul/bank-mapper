using BankMapper.Domain.Enums;

namespace BankMapper.Application.Users;

public class UserDto
{
    public string Id { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public bool EmailVerified { get; set; }
}
