using BankMapper.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BankMapper.Domain.Entities;

// Auth yeniden yazilmadan onceki eski semadan ("Username"/"PasswordHash"
// alanlariyla) kalma kayitlar hala Mongo'da duruyor - Mapping.cs/
// MappingSourceSchema.cs'teki ayni korumanin karsiligi: bu olmadan surucu
// taninmayan "Username" alanini gorunce FormatException firlatiyordu.
// Faz 5 (Kullanicilar ekrani) icin GetAllAsync eklenene kadar bu hic fark
// edilmemisti - GetByEmailAsync/GetByIdAsync o eski kaydi hic sorgulamiyordu,
// ama tum koleksiyonu okuyan ilk kod bu oldu (canli tespit, 2026-08-20).
[BsonIgnoreExtraElements]
public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public bool EmailVerified { get; set; }

    // Yeni kayit olanlar en dusuk yetkiyle basliyor. BsonRepresentation(String)
    // - FileFormat vb. diger enum'larla ayni desen, Mongo'da 0/1/2/3 yerine
    // okunabilir "Viewer"/"Admin" vs. yazsin.
    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; } = UserRole.Viewer;

    public string? EmailVerificationToken { get; set; }

    public DateTime? EmailVerificationTokenExpiresAt { get; set; }

    public string? PasswordResetToken { get; set; }

    public DateTime? PasswordResetTokenExpiresAt { get; set; }
}
