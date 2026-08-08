namespace BankMapper.Application.FieldMatching;

public class FieldMatchSuggestion
{
    public List<string> SourceFields { get; set; } = [];

    public string TargetField { get; set; } = string.Empty;

    // null/bos = direkt 1:1 eslesme, "Concat" = iki alani birlestirme onerisi.
    public string? FunctoidCode { get; set; }
}
