namespace BankMapper.Domain.Entities;

public class FieldMapping
{
    public string TargetField { get; set; } = string.Empty;

    public List<string> SourceFields { get; set; } = [];

    public List<FunctoidStep> FunctoidChain { get; set; } = [];
}
