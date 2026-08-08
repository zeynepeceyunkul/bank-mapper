namespace BankMapper.Domain.Entities;

public class TargetField
{
    public string Name { get; set; } = string.Empty;

    // Bilincli sinirlama (7a): bkz. SourceField.Type - ayni sekilde su an sadece
    // bilgi amacli, gercek tip dogrulamasi yok ve planlanmiyor.
    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? Length { get; set; }
}
