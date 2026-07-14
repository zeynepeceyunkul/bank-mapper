namespace BankMapper.Domain.Functoids;

public class LowerFunctoid : IFunctoid
{
    public string Code => "Lower";

    public object? Execute(object?[] inputs, Dictionary<string, object>? parameters) =>
        inputs[0]?.ToString()?.ToLowerInvariant();
}
