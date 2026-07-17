namespace BankMapper.Application.Mappings;

public class FunctoidStepDto
{
    public string Type { get; set; } = string.Empty;

    public int Order { get; set; }

    public Dictionary<string, object>? Params { get; set; }

    public List<string>? AppliesTo { get; set; }

    public double? PositionX { get; set; }

    public double? PositionY { get; set; }
}
