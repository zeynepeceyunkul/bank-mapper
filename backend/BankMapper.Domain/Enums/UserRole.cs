namespace BankMapper.Domain.Enums;

// Eskiden "Admin" - Ece'nin karari (2026-08-24): rol adi "SuperAdmin" olarak
// degistirildi, ayri bir ust-katman rol EKLENMEDI (yani UserManage policy'si
// hala sadece bu tek rol icin gecerli - eskiden Admin icin oldugu gibi).
// [BsonRepresentation(BsonType.String)] kullanildigi icin (bkz. User.cs) bu
// isim degisikligi Mongo'daki mevcut Role:"Admin" kayitlarini da etkiliyor -
// mevcut kullanicilarin Role alani Role:"SuperAdmin" olarak elle guncellendi
// (hem yerel hem Atlas'ta).
public enum UserRole
{
    Viewer,
    MappingDefiner,
    Approver,
    SuperAdmin
}
