namespace BankMapper.Domain.Entities;

public class FunctoidNode
{
    public string Id { get; set; } = string.Empty;

    public string FunctoidCode { get; set; } = string.Empty;

    public Dictionary<string, object>? Params { get; set; }

    public double PositionX { get; set; }

    public double PositionY { get; set; }
}
