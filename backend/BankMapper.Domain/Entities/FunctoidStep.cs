namespace BankMapper.Domain.Entities;

public class FunctoidStep
{
    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public Dictionary<string, object>? Params { get; set; }

    public List<string>? AppliesTo { get; set; }
}
