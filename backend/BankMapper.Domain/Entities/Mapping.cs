using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

public class Mapping
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.ObjectId)]
    public string SourceSchemaId { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.ObjectId)]
    public string FileTypeId { get; set; } = string.Empty;

    public List<FieldMapping> FieldMappings { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? CreatedBy { get; set; }
}
