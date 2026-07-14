namespace BankMapper.Domain.Functoids;

public class UpperFunctoid : IFunctoid
{
    public string Code => "Upper";

    public object? Execute(object?[] inputs, Dictionary<string, object>? parameters) =>
        inputs[0]?.ToString()?.ToUpperInvariant();
}
