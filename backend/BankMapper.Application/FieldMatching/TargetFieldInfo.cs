namespace BankMapper.Application.FieldMatching;

// Length, LPad/RPad onerisi icin gerekli - AI'nin uydurmasina degil,
// TargetField.Length'in kendisine dayanmasi gerekiyor (bkz.
// GeminiFieldMatchSuggestionService.ParseSuggestions).
public record TargetFieldInfo(string Name, int? Length);
