using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

public class MappingSourceSchema
{
    [BsonRepresentation(BsonType.ObjectId)]
    public string SourceSchemaId { get; set; } = string.Empty;

    public string Alias { get; set; } = string.Empty;

    public string? JoinKeyField { get; set; }
}
