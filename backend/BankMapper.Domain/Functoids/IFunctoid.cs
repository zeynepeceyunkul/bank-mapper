namespace BankMapper.Domain.Functoids;

public interface IFunctoid
{
    string Code { get; }

    object? Execute(object?[] inputs, Dictionary<string, object>? parameters);
}
