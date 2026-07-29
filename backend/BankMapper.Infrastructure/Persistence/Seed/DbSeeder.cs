using BankMapper.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BankMapper.Infrastructure.Persistence.Seed;

public static class DbSeeder
{
    public static async Task SeedAsync(IMongoDbContext context)
    {
        var products = context.GetCollection<Product>(MongoCollectionNames.Products);
        if (await products.EstimatedDocumentCountAsync() > 0)
        {
            return;
        }

        var maasProduct = new Product
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Code = "MAAS",
            Name = "Maas Odeme"
        };

        var vergiProduct = new Product
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Code = "VERGI",
            Name = "Vergi Odeme"
        };

        await products.InsertManyAsync([maasProduct, vergiProduct]);

        var fileTypes = context.GetCollection<FileType>(MongoCollectionNames.FileTypes);

        var maasOdemeDosyasi = new FileType
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ProductId = maasProduct.Id,
            Code = "MAAS_ODEME_DOSYASI",
            Name = "Maas Odeme Dosyasi",
            TargetFields =
            [
                new TargetField { Name = "TCKimlikNo", Type = "string", Order = 1, Length = 11 },
                new TargetField { Name = "AdSoyad", Type = "string", Order = 2, Length = 50 },
                new TargetField { Name = "IBAN", Type = "string", Order = 3, Length = 26 },
                new TargetField { Name = "NetTutar", Type = "decimal", Order = 4 }
            ]
        };

        var vergiOdemeDosyasi = new FileType
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ProductId = vergiProduct.Id,
            Code = "VERGI_ODEME_DOSYASI",
            Name = "Vergi Odeme Dosyasi",
            TargetFields =
            [
                new TargetField { Name = "TCKimlikNo", Type = "string", Order = 1, Length = 11 },
                new TargetField { Name = "VergiDonemi", Type = "string", Order = 2, Length = 10 },
                new TargetField { Name = "VergiTutari", Type = "decimal", Order = 3 },
                new TargetField { Name = "IBAN", Type = "string", Order = 4, Length = 26 }
            ]
        };

        await fileTypes.InsertManyAsync([maasOdemeDosyasi, vergiOdemeDosyasi]);
    }
}
