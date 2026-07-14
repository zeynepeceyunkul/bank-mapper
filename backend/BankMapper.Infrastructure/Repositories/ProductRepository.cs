using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class ProductRepository(IMongoDbContext context) : IProductRepository
{
    private readonly IMongoCollection<Product> _collection =
        context.GetCollection<Product>(MongoCollectionNames.Products);

    public async Task<List<Product>> GetAllAsync() =>
        await _collection.Find(FilterDefinition<Product>.Empty).ToListAsync();
}
