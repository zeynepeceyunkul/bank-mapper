using BankMapper.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public bool EmailVerified { get; set; }

    // Yeni kayit olanlar en dusuk yetkiyle basliyor - rol atamasi icin henuz
    // bir yonetim ekrani yok, v1'de Mongo'da elle guncelleniyor (bkz. plan).
    // BsonRepresentation(String) - FileFormat vb. diger enum'larla ayni
    // desen, Mongo'da 0/1/2/3 yerine okunabilir "Viewer"/"Admin" vs. yazsin.
    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; } = UserRole.Viewer;

    public string? EmailVerificationToken { get; set; }

    public DateTime? EmailVerificationTokenExpiresAt { get; set; }
}
