using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class MappingRepository(IMongoDbContext context) : IMappingRepository
{
    private readonly IMongoCollection<Mapping> _collection =
        context.GetCollection<Mapping>(MongoCollectionNames.Mappings);

    public async Task<Mapping> CreateAsync(Mapping mapping)
    {
        mapping.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(mapping);
        return mapping;
    }
}
