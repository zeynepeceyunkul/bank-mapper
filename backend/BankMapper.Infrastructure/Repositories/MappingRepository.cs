using System.Text.RegularExpressions;
using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
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

    // Mongo tek sorguda hem sayfa hem toplam sayi donmuyor - ikisi paralel
    // calistiriliyor. Varsayilan (RecentFirst) UpdatedAt'e gore azalan sirali
    // (bankada "en cok ugrasilan/guncel" kayitlar en ustte gorunsun diye).
    public async Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null)
    {
        // Regex.Escape ile kullanicinin girdigi metin regex ozel karakteri
        // olarak degil duz metin olarak eslesiyor (orn. "test." metnindeki
        // "." her karaktere degil sadece gercek noktaya eslessin diye).
        var filter = string.IsNullOrWhiteSpace(search)
            ? FilterDefinition<Mapping>.Empty
            : Builders<Mapping>.Filter.Regex(m => m.Name, new BsonRegularExpression(Regex.Escape(search.Trim()), "i"));
        var countTask = _collection.CountDocumentsAsync(filter);
        var find = _collection.Find(filter);
        var sorted = sort switch
        {
            SortOption.NameAscending => find.SortBy(m => m.Name),
            SortOption.NameDescending => find.SortByDescending(m => m.Name),
            SortOption.OldestFirst => find.SortBy(m => m.UpdatedAt),
            _ => find.SortByDescending(m => m.UpdatedAt),
        };
        var itemsTask = sorted
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();
        await Task.WhenAll(countTask, itemsTask);
        return (itemsTask.Result, countTask.Result);
    }

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

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(m => m.Id == id);
        return result.DeletedCount > 0;
    }
}
