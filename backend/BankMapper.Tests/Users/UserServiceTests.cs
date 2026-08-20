using BankMapper.Application.Abstractions;
using BankMapper.Application.Users;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using Xunit;

namespace BankMapper.Tests.Users;

public class UserServiceTests
{
    private static UserService CreateService(FakeUserRepository? repository = null) =>
        new(repository ?? new FakeUserRepository());

    [Fact]
    public async Task GetAllAsync_returns_every_user_as_dto()
    {
        var repository = new FakeUserRepository();
        repository.Add(new User { Id = "u-1", Email = "a@example.com", Role = UserRole.Viewer, EmailVerified = true });
        repository.Add(new User { Id = "u-2", Email = "b@example.com", Role = UserRole.Admin, EmailVerified = false });
        var service = CreateService(repository);

        var users = await service.GetAllAsync();

        Assert.Equal(2, users.Count);
        Assert.Contains(users, u => u.Email == "a@example.com" && u.Role == UserRole.Viewer && u.EmailVerified);
        Assert.Contains(users, u => u.Email == "b@example.com" && u.Role == UserRole.Admin && !u.EmailVerified);
    }

    [Fact]
    public async Task UpdateRoleAsync_changes_another_users_role()
    {
        var repository = new FakeUserRepository();
        repository.Add(new User { Id = "u-1", Email = "a@example.com", Role = UserRole.Viewer });
        var service = CreateService(repository);

        var updated = await service.UpdateRoleAsync("u-1", UserRole.MappingDefiner, currentUserId: "u-admin");

        Assert.NotNull(updated);
        Assert.Equal(UserRole.MappingDefiner, updated!.Role);
    }

    [Fact]
    public async Task UpdateRoleAsync_is_blocked_when_changing_your_own_role()
    {
        var repository = new FakeUserRepository();
        repository.Add(new User { Id = "u-admin", Email = "admin@example.com", Role = UserRole.Admin });
        var service = CreateService(repository);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.UpdateRoleAsync("u-admin", UserRole.Viewer, currentUserId: "u-admin"));
        Assert.Contains("Kendi rolünüzü değiştiremezsiniz", ex.Message);
    }

    [Fact]
    public async Task UpdateRoleAsync_for_a_nonexistent_id_returns_null()
    {
        var service = CreateService();

        var updated = await service.UpdateRoleAsync("does-not-exist", UserRole.Admin, currentUserId: "u-admin");

        Assert.Null(updated);
    }

    private class FakeUserRepository : IUserRepository
    {
        private readonly Dictionary<string, User> _store = [];

        public void Add(User user) => _store[user.Id] = user;

        public Task<List<User>> GetAllAsync() => Task.FromResult(_store.Values.ToList());

        public Task<User?> GetByEmailAsync(string email) =>
            Task.FromResult(_store.Values.FirstOrDefault(u => u.Email == email));

        public Task<User?> GetByIdAsync(string id) => Task.FromResult(_store.GetValueOrDefault(id));

        public Task<User> CreateAsync(User user)
        {
            _store[user.Id] = user;
            return Task.FromResult(user);
        }

        public Task UpdateAsync(User user)
        {
            _store[user.Id] = user;
            return Task.CompletedTask;
        }
    }
}
