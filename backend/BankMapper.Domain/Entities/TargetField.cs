using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using BankMapper.Domain.Enums;

namespace BankMapper.Domain.Entities;

public class TargetField
{
    public string Name { get; set; } = string.Empty;

    // Bilincli sinirlama (7a): bkz. SourceField.Type - ayni sekilde su an sadece
    // bilgi amacli, gercek tip dogrulamasi yok ve planlanmiyor. ValidationFormat
    // bundan ayri ve dar kapsamli bir mekanizma - sadece bilinen, matematiksel
    // olarak dogrulanabilir birkac format (IBAN/TC kimlik/pozitif tutar) icin,
    // Type'in genel/planlanmayan tip sistemiyle karistirilmamali.
    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? Length { get; set; }

    public bool IsRequired { get; set; }

    [BsonRepresentation(BsonType.String)]
    public FieldValidationFormat ValidationFormat { get; set; } = FieldValidationFormat.None;
}
