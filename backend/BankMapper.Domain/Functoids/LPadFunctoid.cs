namespace BankMapper.Domain.Functoids;

public class LPadFunctoid : IFunctoid
{
    public string Code => "LPad";

    public IReadOnlyList<string> InputPorts => ["value"];

    public object? Execute(object?[] inputs, Dictionary<string, object>? parameters)
    {
        var value = inputs[0]?.ToString() ?? string.Empty;
        var length = FunctoidParams.GetInt(parameters, "length", value.Length);
        var padChar = FunctoidParams.GetString(parameters, "padChar", " ");
        return value.PadLeft(length, padChar.Length > 0 ? padChar[0] : ' ');
    }
}
