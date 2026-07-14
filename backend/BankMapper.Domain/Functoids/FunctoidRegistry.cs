namespace BankMapper.Domain.Functoids;

public class FunctoidRegistry
{
    private readonly Dictionary<string, IFunctoid> _functoids;

    public FunctoidRegistry(IEnumerable<IFunctoid> functoids)
    {
        _functoids = functoids.ToDictionary(f => f.Code);
    }

    public IFunctoid Get(string code) => _functoids[code];

    public IReadOnlyCollection<string> AvailableCodes => _functoids.Keys.ToList();
}
