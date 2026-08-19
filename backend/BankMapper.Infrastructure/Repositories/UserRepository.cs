using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class UserRepository(IMongoDbContext context) : IUserRepository
{
    private readonly IMongoCollection<User> _collection =
        context.GetCollection<User>(MongoCollectionNames.Users);

    public async Task<User?> GetByEmailAsync(string email) =>
        await _collection.Find(u => u.Email == email).FirstOrDefaultAsync();

    public async Task<User> CreateAsync(User user)
    {
        user.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(user);
        return user;
    }

    public async Task UpdateAsync(User user) =>
        await _collection.ReplaceOneAsync(u => u.Id == user.Id, user);
}
