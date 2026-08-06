namespace BankMapper.Domain.Entities;

public class SourceField
{
    public string Name { get; set; } = string.Empty;

    // Bilincli sinirlama (7a): bu alan su an sadece bilgi amacli tutuluyor,
    // parse/mapping asamalarinin hicbirinde gercek bir tip donusumu/dogrulama
    // tetiklemiyor - her sey ham metin olarak isleniyor. Tip bazli bir
    // validasyon eklenmesi (orn. "decimal" alan gercekten sayi mi) su an icin
    // planlanmiyor (bkz. proje karari: 4a maddesi degerlendirilip iptal edildi).
    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? StartIndex { get; set; }

    public int? Length { get; set; }
}
