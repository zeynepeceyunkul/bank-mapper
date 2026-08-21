using System.Text.RegularExpressions;
using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class UserRepository(IMongoDbContext context) : IUserRepository
{
    private readonly IMongoCollection<User> _collection =
        context.GetCollection<User>(MongoCollectionNames.Users);

    public async Task<List<User>> GetAllAsync() =>
        await _collection.Find(FilterDefinition<User>.Empty).ToListAsync();

    // institution-list.scss'teki GetPagedAsync ile ayni desen (arama regex,
    // NameAscending/Descending sirali secenekler burada Email'e uygulaniyor).
    // Ek olarak: eski semadan kalma e-postasiz kayit (bkz. User.cs yorumu)
    // her zaman disarida - UserService.GetAllAsync'teki ayni koruma burada
    // da uygulanmazsa sayfalama/toplam sayi o hayalet kaydi da sayardi.
    public async Task<(List<User> Items, long TotalCount)> GetPagedAsync(
        int pageIndex, int pageSize, SortOption sort, string? search = null, UserRole? role = null)
    {
        var filters = new List<FilterDefinition<User>>
        {
            Builders<User>.Filter.Ne(u => u.Email, string.Empty),
        };
        if (!string.IsNullOrWhiteSpace(search))
        {
            filters.Add(Builders<User>.Filter.Regex(u => u.Email, new BsonRegularExpression(Regex.Escape(search.Trim()), "i")));
        }
        if (role is not null)
        {
            filters.Add(Builders<User>.Filter.Eq(u => u.Role, role.Value));
        }
        var filter = Builders<User>.Filter.And(filters);

        var countTask = _collection.CountDocumentsAsync(filter);
        var find = _collection.Find(filter);
        var sorted = sort switch
        {
            SortOption.NameDescending => find.SortByDescending(u => u.Email),
            SortOption.RecentFirst => find.SortByDescending(u => u.Id),
            SortOption.OldestFirst => find.SortBy(u => u.Id),
            _ => find.SortBy(u => u.Email),
        };
        var itemsTask = sorted.Skip(pageIndex * pageSize).Limit(pageSize).ToListAsync();
        await Task.WhenAll(countTask, itemsTask);
        return (itemsTask.Result, countTask.Result);
    }

    public async Task<User?> GetByEmailAsync(string email) =>
        await _collection.Find(u => u.Email == email).FirstOrDefaultAsync();

    public async Task<User?> GetByIdAsync(string id) =>
        await _collection.Find(u => u.Id == id).FirstOrDefaultAsync();

    public async Task<User> CreateAsync(User user)
    {
        user.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(user);
        return user;
    }

    public async Task UpdateAsync(User user) =>
        await _collection.ReplaceOneAsync(u => u.Id == user.Id, user);
}
