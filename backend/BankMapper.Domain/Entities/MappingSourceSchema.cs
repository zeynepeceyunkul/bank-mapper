using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

// Multi-source mapping kaldirilirken JoinKeyField alani silindi (bkz. proje karari),
// ama Mongo'daki eski kayitlarda bu alan hala duruyor ("JoinKeyField": null).
// [BsonIgnoreExtraElements] olmadan surucu bunu "taninmayan alan" diye FormatException
// firlatiyordu - Mapping sinifindaki ayni amacli korumanin aynisi burada da lazim.
[BsonIgnoreExtraElements]
public class MappingSourceSchema
{
    [BsonRepresentation(BsonType.ObjectId)]
    public string SourceSchemaId { get; set; } = string.Empty;

    public string Alias { get; set; } = string.Empty;

    public double PositionX { get; set; }

    public double PositionY { get; set; }
}
