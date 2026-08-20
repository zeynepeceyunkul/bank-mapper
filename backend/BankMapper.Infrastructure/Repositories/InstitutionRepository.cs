using System.Text.RegularExpressions;
using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class InstitutionRepository(IMongoDbContext context) : IInstitutionRepository
{
    private readonly IMongoCollection<Institution> _collection =
        context.GetCollection<Institution>(MongoCollectionNames.Institutions);

    public async Task<List<Institution>> GetAllAsync() =>
        await _collection.Find(FilterDefinition<Institution>.Empty).ToListAsync();

    // SourceSchemaRepository.GetPagedAsync ile ayni gerekce: ayri bir
    // CreatedAt alani tutmuyoruz, Mongo'nun ObjectId'si zaten kronolojik
    // sirali oldugu icin RecentFirst/OldestFirst dogrudan Id'ye gore siralar.
    public async Task<(List<Institution> Items, long TotalCount)> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null)
    {
        var filter = string.IsNullOrWhiteSpace(search)
            ? FilterDefinition<Institution>.Empty
            : Builders<Institution>.Filter.Regex(i => i.Name, new BsonRegularExpression(Regex.Escape(search.Trim()), "i"));
        var countTask = _collection.CountDocumentsAsync(filter);
        var find = _collection.Find(filter);
        var sorted = sort switch
        {
            SortOption.NameDescending => find.SortByDescending(i => i.Name),
            SortOption.RecentFirst => find.SortByDescending(i => i.Id),
            SortOption.OldestFirst => find.SortBy(i => i.Id),
            _ => find.SortBy(i => i.Name),
        };
        var itemsTask = sorted
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();
        await Task.WhenAll(countTask, itemsTask);
        return (itemsTask.Result, countTask.Result);
    }

    public async Task<Institution?> GetByIdAsync(string id) =>
        await _collection.Find(i => i.Id == id).FirstOrDefaultAsync();

    public async Task<Institution> CreateAsync(Institution institution)
    {
        institution.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(institution);
        return institution;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(i => i.Id == id);
        return result.DeletedCount > 0;
    }
}
