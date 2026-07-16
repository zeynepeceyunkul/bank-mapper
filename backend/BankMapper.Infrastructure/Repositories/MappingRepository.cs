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

    public async Task<List<Mapping>> GetAllAsync() =>
        await _collection.Find(FilterDefinition<Mapping>.Empty).ToListAsync();

    public async Task<Mapping?> GetByIdAsync(string id) =>
        await _collection.Find(m => m.Id == id).FirstOrDefaultAsync();

    public async Task<Mapping> CreateAsync(Mapping mapping)
    {
        mapping.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(mapping);
        return mapping;
    }

    public async Task<Mapping?> UpdateAsync(Mapping mapping)
    {
        var result = await _collection.ReplaceOneAsync(m => m.Id == mapping.Id, mapping);
        return result.MatchedCount > 0 ? mapping : null;
    }
}
