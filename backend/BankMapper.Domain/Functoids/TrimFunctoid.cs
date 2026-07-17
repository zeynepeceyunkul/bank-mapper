namespace BankMapper.Domain.Functoids;

public class TrimFunctoid : IFunctoid
{
    public string Code => "Trim";

    public IReadOnlyList<string> InputPorts => ["value"];

    public object? Execute(object?[] inputs, Dictionary<string, object>? parameters) =>
        inputs[0]?.ToString()?.Trim();
}
