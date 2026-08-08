using BankMapper.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using Xunit;

namespace BankMapper.Tests.Entities;

public class MappingSourceSchemaTests
{
    [Fact]
    public void Deserializing_a_legacy_document_with_the_removed_JoinKeyField_does_not_throw()
    {
        // Multi-source mapping kaldirilirken JoinKeyField silindi ama Mongo'daki eski
        // kayitlarda hala bu alan var ("JoinKeyField": null) - MappingSourceSchema'da
        // [BsonIgnoreExtraElements] olmadan bu bir FormatException firlatiyordu (gercek
        // production bug'i, canli Mongo verisiyle bulundu 2026-08-05 - "Kayitli
        // Mapping'ler" listesi API'den 400 donuyordu).
        var document = BsonDocument.Parse("""
        {
            "_id": "6a59e439570627428feeb6c1",
            "Name": "test",
            "SourceSchemas": [
                { "SourceSchemaId": "6a55e16824606456ae5c56f9", "Alias": "A", "JoinKeyField": null, "PositionX": 0, "PositionY": 0 }
            ],
            "FileTypeId": "6a4e41176840f1c7467e9ddd",
            "FunctoidNodes": [],
            "ConstantNodes": [],
            "Edges": [],
            "CreatedAt": { "$date": "2026-01-01T00:00:00Z" },
            "UpdatedAt": { "$date": "2026-01-01T00:00:00Z" },
            "CreatedBy": null
        }
        """);

        var mapping = BsonSerializer.Deserialize<Mapping>(document);

        Assert.Equal("test", mapping.Name);
        Assert.Single(mapping.SourceSchemas);
        Assert.Equal("A", mapping.SourceSchemas[0].Alias);
    }
}
