using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
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
    public async Task GetPagedAsync_returns_only_the_requested_page_and_the_real_total_count()
    {
        var repository = new FakeUserRepository();
        foreach (var email in new[] { "a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com" })
        {
            repository.Add(new User { Id = email, Email = email, Role = UserRole.Viewer });
        }
        var service = CreateService(repository);

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 2, SortOption.NameAscending);

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.TotalCount);
    }

    [Fact]
    public async Task GetPagedAsync_filters_by_email_search_case_insensitively()
    {
        var repository = new FakeUserRepository();
        repository.Add(new User { Id = "u-1", Email = "ayse.kaya@banka.com", Role = UserRole.Viewer });
        repository.Add(new User { Id = "u-2", Email = "mehmet.demir@banka.com", Role = UserRole.Viewer });
        var service = CreateService(repository);

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending, search: "AYSE");

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("ayse.kaya@banka.com", page.Items[0].Email);
    }

    [Fact]
    public async Task GetPagedAsync_filters_by_role()
    {
        var repository = new FakeUserRepository();
        repository.Add(new User { Id = "u-1", Email = "admin@banka.com", Role = UserRole.Admin });
        repository.Add(new User { Id = "u-2", Email = "viewer@banka.com", Role = UserRole.Viewer });
        var service = CreateService(repository);

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending, role: UserRole.Admin);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("admin@banka.com", page.Items[0].Email);
    }

    [Fact]
    public async Task GetPagedAsync_excludes_the_legacy_email_less_record()
    {
        // Auth yeniden yazilmadan onceki eski semadan kalma kayit - GetAllAsync
        // ile ayni koruma GetPagedAsync icin de gecerli olmali.
        var repository = new FakeUserRepository();
        repository.Add(new User { Id = "legacy", Email = "", Role = UserRole.Viewer });
        repository.Add(new User { Id = "u-1", Email = "real@banka.com", Role = UserRole.Viewer });
        var service = CreateService(repository);

        var page = await service.GetPagedAsync(pageIndex: 0, pageSize: 10, SortOption.NameAscending);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("real@banka.com", page.Items[0].Email);
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

        public Task<(List<User> Items, long TotalCount)> GetPagedAsync(
            int pageIndex, int pageSize, SortOption sort, string? search = null, UserRole? role = null)
        {
            IEnumerable<User> filtered = _store.Values.Where(u => !string.IsNullOrEmpty(u.Email));
            if (!string.IsNullOrWhiteSpace(search))
            {
                filtered = filtered.Where(u => u.Email.Contains(search, StringComparison.OrdinalIgnoreCase));
            }
            if (role is not null)
            {
                filtered = filtered.Where(u => u.Role == role.Value);
            }

            IEnumerable<User> ordered = sort switch
            {
                SortOption.NameDescending => filtered.OrderByDescending(u => u.Email, StringComparer.Ordinal),
                SortOption.RecentFirst => filtered.OrderByDescending(u => u.Id, StringComparer.Ordinal),
                SortOption.OldestFirst => filtered.OrderBy(u => u.Id, StringComparer.Ordinal),
                _ => filtered.OrderBy(u => u.Email, StringComparer.Ordinal),
            };
            var list = ordered.ToList();
            var page = list.Skip(pageIndex * pageSize).Take(pageSize).ToList();
            return Task.FromResult((page, (long)list.Count));
        }

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
