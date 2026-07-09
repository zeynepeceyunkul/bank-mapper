namespace BankMapper.Domain.Entities;

public class SourceField
{
    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? StartIndex { get; set; }

    public int? Length { get; set; }
}
