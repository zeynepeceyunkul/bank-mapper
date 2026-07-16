using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class FileTypeRepository(IMongoDbContext context) : IFileTypeRepository
{
    private readonly IMongoCollection<FileType> _collection =
        context.GetCollection<FileType>(MongoCollectionNames.FileTypes);

    public async Task<List<FileType>> GetByProductIdAsync(string productId) =>
        await _collection.Find(ft => ft.ProductId == productId).ToListAsync();

    public async Task<FileType?> GetByIdAsync(string id) =>
        await _collection.Find(ft => ft.Id == id).FirstOrDefaultAsync();
}
