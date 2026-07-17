using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

// Faz 9 oncesi eski sekilli (SourceSchemaId/FieldMappings) kayitlarin deserialize
// sirasinda hata firlatmasini onlemek icin bilinmeyen alanlar yok sayilir.
[BsonIgnoreExtraElements]
public class Mapping
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<MappingSourceSchema> SourceSchemas { get; set; } = [];

    [BsonRepresentation(BsonType.ObjectId)]
    public string FileTypeId { get; set; } = string.Empty;

    public List<FunctoidNode> FunctoidNodes { get; set; } = [];

    public List<ConstantNode> ConstantNodes { get; set; } = [];

    public List<GraphEdge> Edges { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? CreatedBy { get; set; }
}
