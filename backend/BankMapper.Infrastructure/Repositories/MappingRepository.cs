using System.Text.RegularExpressions;
using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class MappingRepository(IMongoDbContext context) : IMappingRepository
{
    private readonly IMongoCollection<Mapping> _collection =
        context.GetCollection<Mapping>(MongoCollectionNames.Mappings);

    public async Task<List<Mapping>> GetAllAsync(MappingStatus? status = null, string? kurumId = null)
    {
        var filters = new List<FilterDefinition<Mapping>>();
        if (status is not null)
        {
            filters.Add(Builders<Mapping>.Filter.Eq(m => m.Status, status.Value));
        }
        if (!string.IsNullOrWhiteSpace(kurumId))
        {
            filters.Add(Builders<Mapping>.Filter.AnyEq(m => m.KurumIds, kurumId));
        }
        var filter = filters.Count == 0 ? FilterDefinition<Mapping>.Empty : Builders<Mapping>.Filter.And(filters);
        return await _collection.Find(filter).ToListAsync();
    }

    // Mongo tek sorguda hem sayfa hem toplam sayi donmuyor - ikisi paralel
    // calistiriliyor. Varsayilan (RecentFirst) UpdatedAt'e gore azalan sirali
    // (bankada "en cok ugrasilan/guncel" kayitlar en ustte gorunsun diye).
    public async Task<(List<Mapping> Items, long TotalCount)> GetPagedAsync(
        int pageIndex, int pageSize, SortOption sort, string? search = null, MappingStatus? status = null,
        string? kurumId = null, string? createdBy = null)
    {
        // Regex.Escape ile kullanicinin girdigi metin regex ozel karakteri
        // olarak degil duz metin olarak eslesiyor (orn. "test." metnindeki
        // "." her karaktere degil sadece gercek noktaya eslessin diye).
        var filters = new List<FilterDefinition<Mapping>>();
        if (!string.IsNullOrWhiteSpace(search))
        {
            filters.Add(Builders<Mapping>.Filter.Regex(m => m.Name, new BsonRegularExpression(Regex.Escape(search.Trim()), "i")));
        }
        if (status is not null)
        {
            filters.Add(Builders<Mapping>.Filter.Eq(m => m.Status, status.Value));
        }
        if (!string.IsNullOrWhiteSpace(kurumId))
        {
            filters.Add(Builders<Mapping>.Filter.AnyEq(m => m.KurumIds, kurumId));
        }
        if (!string.IsNullOrWhiteSpace(createdBy))
        {
            filters.Add(Builders<Mapping>.Filter.Eq(m => m.CreatedBy, createdBy));
        }
        var filter = filters.Count == 0 ? FilterDefinition<Mapping>.Empty : Builders<Mapping>.Filter.And(filters);

        var countTask = _collection.CountDocumentsAsync(filter);
        var find = _collection.Find(filter);
        var sorted = sort switch
        {
            SortOption.NameAscending => find.SortBy(m => m.Name),
            SortOption.NameDescending => find.SortByDescending(m => m.Name),
            SortOption.OldestFirst => find.SortBy(m => m.UpdatedAt),
            SortOption.StatusDateRecentFirst => SortByStatusDate(find, status, descending: true),
            SortOption.StatusDateOldestFirst => SortByStatusDate(find, status, descending: false),
            _ => find.SortByDescending(m => m.UpdatedAt),
        };
        var itemsTask = sorted
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();
        await Task.WhenAll(countTask, itemsTask);
        return (itemsTask.Result, countTask.Result);
    }

    // Onaylar ekraninin uc sekmesi (Bekleyenler/Onaylanan/Reddedilen) ayni
    // "tarihe gore sirala" toggle'ini kullaniyor ama her biri kendi tarih
    // sutununu gostiriyor - status burada zaten filtre olarak gelmis
    // oluyor, hangi alanin kullanilacagini da o belirliyor. status null ise
    // (bu iki SortOption degeri baska bir yerden status'suz cagrilmaz ama
    // yine de) CreatedAt'e dusuluyor.
    private static IFindFluent<Mapping, Mapping> SortByStatusDate(
        IFindFluent<Mapping, Mapping> find, MappingStatus? status, bool descending)
    {
        return status switch
        {
            MappingStatus.Approved => descending ? find.SortByDescending(m => m.ApprovedAt) : find.SortBy(m => m.ApprovedAt),
            MappingStatus.Rejected => descending ? find.SortByDescending(m => m.RejectedAt) : find.SortBy(m => m.RejectedAt),
            _ => descending ? find.SortByDescending(m => m.CreatedAt) : find.SortBy(m => m.CreatedAt),
        };
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

    public async Task<Mapping?> UpdateIfStatusAsync(Mapping mapping, MappingStatus expectedCurrentStatus)
    {
        var filter = Builders<Mapping>.Filter.And(
            Builders<Mapping>.Filter.Eq(m => m.Id, mapping.Id),
            Builders<Mapping>.Filter.Eq(m => m.Status, expectedCurrentStatus));
        var result = await _collection.ReplaceOneAsync(filter, mapping);
        return result.MatchedCount > 0 ? mapping : null;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(m => m.Id == id);
        return result.DeletedCount > 0;
    }
}
