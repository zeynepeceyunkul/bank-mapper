using BankMapper.Domain.Enums;
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

    // Her kayit (olusturma ya da guncelleme) otomatik PendingApproval'a
    // duser - onaylanmis bir mapping duzenlenirse tekrar onaya dusmesi
    // bilincli bir karar (bkz. Ece ile 2026-08-19 tartismasi), onay
    // adiminin gercek bir anlami olsun diye.
    [BsonRepresentation(BsonType.String)]
    public MappingStatus Status { get; set; } = MappingStatus.PendingApproval;

    public string? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? RejectionReason { get; set; }

    public string? RejectedBy { get; set; }

    public DateTime? RejectedAt { get; set; }
}
