using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class SourceSchemaRepository(IMongoDbContext context) : ISourceSchemaRepository
{
    private readonly IMongoCollection<SourceSchema> _collection =
        context.GetCollection<SourceSchema>(MongoCollectionNames.SourceSchemas);

    public async Task<List<SourceSchema>> GetAllAsync() =>
        await _collection.Find(FilterDefinition<SourceSchema>.Empty).ToListAsync();

    public async Task<SourceSchema> CreateAsync(SourceSchema schema)
    {
        schema.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(schema);
        return schema;
    }
}
