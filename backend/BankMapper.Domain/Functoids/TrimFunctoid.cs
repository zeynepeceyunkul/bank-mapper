namespace BankMapper.Domain.Functoids;

public class TrimFunctoid : IFunctoid
{
    public string Code => "Trim";

    public object? Execute(object?[] inputs, Dictionary<string, object>? parameters) =>
        inputs[0]?.ToString()?.Trim();
}
