namespace BankMapper.Domain.Entities;

public class TargetField
{
    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? Length { get; set; }
}
