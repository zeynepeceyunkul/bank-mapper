using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IJwtTokenGenerator
{
    string GenerateToken(User user);
}
