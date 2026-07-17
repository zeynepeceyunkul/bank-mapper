using BankMapper.Application.Functoids;
using BankMapper.Domain.Functoids;
using Xunit;

namespace BankMapper.Tests.Functoids;

public class FunctoidServiceTests
{
    private static FunctoidRegistry CreateRegistry() => new(
    [
        new TrimFunctoid(),
        new UpperFunctoid(),
        new LowerFunctoid(),
        new ConcatFunctoid(),
        new LPadFunctoid(),
        new RPadFunctoid(),
    ]);

    [Fact]
    public void Every_functoid_input_port_metadata_matches_its_domain_arity()
    {
        var registry = CreateRegistry();
        var service = new FunctoidService(registry);

        foreach (var dto in service.GetAll())
        {
            var expectedPorts = registry.Get(dto.Code).InputPorts;
            Assert.Equal(expectedPorts, dto.InputPorts.Select(p => p.Name));
        }
    }
}
