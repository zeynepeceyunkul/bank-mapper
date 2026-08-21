namespace BankMapper.Application.FieldMatching;

public class FieldMatchSuggestion
{
    public List<string> SourceFields { get; set; } = [];

    public string TargetField { get; set; } = string.Empty;

    // null/bos = direkt 1:1 eslesme, "Concat" = iki alani birlestirme onerisi,
    // "LPad"/"RPad" = tek kaynak alani hedef Length'e doldurma onerisi (bu durumda
    // her zaman onune bir Trim zincirlenir, bkz. proje karari - MappingExecutor'in
    // Length asimini gercek bir hata olarak firlatmasi).
    public string? FunctoidCode { get; set; }

    // AI'den geliyor (sadece LPad/RPad icin anlamli) - null/bos/tek karakterden
    // uzunsa "0"a normalize edilir, bkz. ParseSuggestions.
    public string? PadChar { get; set; }

    // SADECE backend tarafindan, TargetField.Length'ten hesaplanir - AI'nin
    // donduregu bir deger hicbir zaman guvenilmez/kullanilmaz.
    public int? Length { get; set; }
}
