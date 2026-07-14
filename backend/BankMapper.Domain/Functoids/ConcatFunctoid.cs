namespace BankMapper.Domain.Functoids;

public class ConcatFunctoid : IFunctoid
{
    public string Code => "Concat";

    public object? Execute(object?[] inputs, Dictionary<string, object>? parameters)
    {
        var separator = FunctoidParams.GetString(parameters, "separator", string.Empty);
        return string.Join(separator, inputs.Select(i => i?.ToString() ?? string.Empty));
    }
}
