using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Infrastructure.Persistence;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Repositories;

public class MappingRunRepository(IMongoDbContext context) : IMappingRunRepository
{
    private readonly IMongoCollection<MappingRun> _collection =
        context.GetCollection<MappingRun>(MongoCollectionNames.MappingRuns);

    public async Task<MappingRun> CreateAsync(MappingRun run)
    {
        run.Id = ObjectId.GenerateNewId().ToString();
        await _collection.InsertOneAsync(run);
        return run;
    }

    // Bu bir log/gecmis kaydi - diger listelerin aksine kullaniciya sirala
    // secenegi sunmuyoruz, her zaman en yeni calistirma en ustte.
    public async Task<(List<MappingRun> Items, long TotalCount)> GetPagedAsync(
        int pageIndex, int pageSize, RunKind? kind = null, bool? success = null)
    {
        var filters = new List<FilterDefinition<MappingRun>>();
        if (kind is not null)
        {
            filters.Add(Builders<MappingRun>.Filter.Eq(r => r.Kind, kind.Value));
        }

        if (success is not null)
        {
            filters.Add(Builders<MappingRun>.Filter.Eq(r => r.Success, success.Value));
        }

        var filter = filters.Count > 0 ? Builders<MappingRun>.Filter.And(filters) : FilterDefinition<MappingRun>.Empty;
        var countTask = _collection.CountDocumentsAsync(filter);
        var itemsTask = _collection.Find(filter)
            .SortByDescending(r => r.RunAt)
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();
        await Task.WhenAll(countTask, itemsTask);
        return (itemsTask.Result, countTask.Result);
    }
}
