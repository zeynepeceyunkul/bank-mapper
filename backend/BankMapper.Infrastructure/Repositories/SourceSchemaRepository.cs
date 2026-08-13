using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
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

    // Varsayilan (NameAscending) alfabetik sirali. RecentFirst/OldestFirst icin
    // ayri bir CreatedAt alani TUTMUYORUZ - Mongo'nun kendi ObjectId'si (_id)
    // ilk 4 baytinda gercek olusturulma zamanini tasiyor ve dogasi geregi
    // kronolojik sirali, bu yuzden hicbir geriye donuk veri doldurmaya
    // (backfill) gerek kalmadan hem eski hem yeni kayitlarda dogru calisiyor.
    // (Once ayri bir CreatedAt alani denendi, ama bu alan eklenmeden once
    // olusturulmus butun eski kayitlarda deger default(DateTime) - yani hepsi
    // esit - oldugu icin "en yeni once" siralamasi rastgele/anlamsiz cikiyordu.)
    public async Task<(List<SourceSchema> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort)
    {
        var filter = FilterDefinition<SourceSchema>.Empty;
        var countTask = _collection.CountDocumentsAsync(filter);
        var find = _collection.Find(filter);
        var sorted = sort switch
        {
            SortOption.NameDescending => find.SortByDescending(s => s.Name),
            SortOption.RecentFirst => find.SortByDescending(s => s.Id),
            SortOption.OldestFirst => find.SortBy(s => s.Id),
            _ => find.SortBy(s => s.Name),
        };
        var itemsTask = sorted
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();
        await Task.WhenAll(countTask, itemsTask);
        return (itemsTask.Result, countTask.Result);
    }

    public async Task<SourceSchema?> GetByIdAsync(string id) =>
        await _collection.Find(s => s.Id == id).FirstOrDefaultAsync();

    public async Task<SourceSchema> CreateAsync(SourceSchema schema)
    {
        schema.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(schema);
        return schema;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(s => s.Id == id);
        return result.DeletedCount > 0;
    }
}
