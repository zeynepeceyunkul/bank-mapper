using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

public class FileType
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.ObjectId)]
    public string ProductId { get; set; } = string.Empty;

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<TargetField> TargetFields { get; set; } = [];
}
