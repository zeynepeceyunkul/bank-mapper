using BankMapper.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using MongoDB.Bson;

namespace BankMapper.Api;

// Ucuncu parti bir MongoDb health-check paketi eklemek yerine (net10.0 ile
// uyumlulugu dogrulanmamis), mevcut IMongoDbContext uzerinden hafif bir
// EstimatedDocumentCountAsync cagrisiyla gercek baglantiyi test ediyoruz.
public class MongoHealthCheck(IMongoDbContext context) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext healthCheckContext, CancellationToken cancellationToken = default)
    {
        try
        {
            await context.GetCollection<BsonDocument>(MongoCollectionNames.Mappings)
                .EstimatedDocumentCountAsync(cancellationToken: cancellationToken);
            return HealthCheckResult.Healthy("MongoDB baglantisi calisiyor.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("MongoDB baglantisi kurulamadi.", ex);
        }
    }
}
