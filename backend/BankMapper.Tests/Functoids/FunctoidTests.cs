using BankMapper.Domain.Functoids;
using Xunit;

namespace BankMapper.Tests.Functoids;

public class FunctoidTests
{
    [Fact]
    public void Trim_removes_leading_and_trailing_whitespace()
    {
        var result = new TrimFunctoid().Execute(["  Ahmet  "], null);
        Assert.Equal("Ahmet", result);
    }

    [Fact]
    public void Upper_converts_to_uppercase()
    {
        var result = new UpperFunctoid().Execute(["istanbul"], null);
        Assert.Equal("ISTANBUL", result);
    }

    [Fact]
    public void Lower_converts_to_lowercase()
    {
        var result = new LowerFunctoid().Execute(["ANKARA"], null);
        Assert.Equal("ankara", result);
    }

    [Fact]
    public void Concat_joins_inputs_with_separator()
    {
        var result = new ConcatFunctoid().Execute(
            ["Ahmet", "Yilmaz"],
            new Dictionary<string, object> { ["separator"] = " " });

        Assert.Equal("Ahmet Yilmaz", result);
    }

    [Fact]
    public void Concat_without_separator_joins_with_empty_string()
    {
        var result = new ConcatFunctoid().Execute(["A", "B"], null);
        Assert.Equal("AB", result);
    }

    [Fact]
    public void LPad_pads_left_to_reach_target_length()
    {
        var result = new LPadFunctoid().Execute(
            ["123"],
            new Dictionary<string, object> { ["length"] = 11, ["padChar"] = "0" });

        Assert.Equal("00000000123", result);
    }

    [Fact]
    public void RPad_pads_right_to_reach_target_length()
    {
        var result = new RPadFunctoid().Execute(
            ["Ali"],
            new Dictionary<string, object> { ["length"] = 10 });

        Assert.Equal("Ali       ", result);
    }

    [Fact]
    public void Registry_resolves_functoid_by_code()
    {
        var registry = new FunctoidRegistry([new TrimFunctoid(), new UpperFunctoid()]);

        Assert.IsType<TrimFunctoid>(registry.Get("Trim"));
        Assert.Equal(["Trim", "Upper"], registry.AvailableCodes);
    }

    [Fact]
    public void Registry_throws_a_clear_error_for_an_unknown_functoid_code()
    {
        var registry = new FunctoidRegistry([new TrimFunctoid()]);

        var ex = Assert.Throws<ArgumentException>(() => registry.Get("DoesNotExist"));
        Assert.Contains("DoesNotExist", ex.Message);
    }
}
