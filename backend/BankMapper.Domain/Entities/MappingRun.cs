using BankMapper.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

// Bir mapping'in Onizleme (Preview) ya da gercek Donusturme (Convert)
// calistirmasinin kalici kaydi - "dun gece yukledigim dosya duzgun mu
// islendi" sorusuna cevap verebilmek icin. MappingName kasitli olarak
// denormalize edilmis: mapping daha sonra silinse/yeniden adlandirilsa bile
// gecmis kayit hangi mapping oldugunu okunabilir sekilde gostermeye devam etsin diye.
[BsonIgnoreExtraElements]
public class MappingRun
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string MappingId { get; set; } = string.Empty;

    public string MappingName { get; set; } = string.Empty;

    public RunKind Kind { get; set; }

    public List<string> FileNames { get; set; } = [];

    public bool Success { get; set; }

    public int? RowCount { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime RunAt { get; set; }
}
