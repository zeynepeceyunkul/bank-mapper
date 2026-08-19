using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email);

    Task<User?> GetByIdAsync(string id);

    Task<User> CreateAsync(User user);

    Task UpdateAsync(User user);
}
