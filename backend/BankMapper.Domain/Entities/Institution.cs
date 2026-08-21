using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

public class Institution
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
