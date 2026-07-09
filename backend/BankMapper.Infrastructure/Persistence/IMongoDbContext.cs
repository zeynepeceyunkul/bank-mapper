using MongoDB.Driver;

namespace BankMapper.Infrastructure.Persistence;

public interface IMongoDbContext
{
    IMongoCollection<T> GetCollection<T>(string collectionName);
}
