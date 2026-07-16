using BankMapper.Domain.Entities;
using BankMapper.Domain.Execution;
using BankMapper.Domain.Functoids;
using Xunit;

namespace BankMapper.Tests.Execution;

public class MappingExecutorTests
{
    private static MappingExecutor CreateExecutor() => new(new FunctoidRegistry(
    [
        new TrimFunctoid(),
        new UpperFunctoid(),
        new LowerFunctoid(),
        new ConcatFunctoid(),
        new LPadFunctoid(),
        new RPadFunctoid(),
    ]));

    [Fact]
    public void Single_source_field_with_single_functoid_is_applied()
    {
        var mapping = new Mapping
        {
            FieldMappings =
            [
                new FieldMapping
                {
                    TargetField = "TCKimlikNo",
                    SourceFields = ["TC"],
                    FunctoidChain =
                    [
                        new FunctoidStep
                        {
                            Type = "LPad",
                            Order = 1,
                            Params = new Dictionary<string, object> { ["length"] = 11, ["padChar"] = "0" },
                        },
                    ],
                },
            ],
        };

        var result = CreateExecutor().Apply(mapping, new Dictionary<string, string?> { ["TC"] = "123" });

        Assert.Equal("00000000123", result["TCKimlikNo"]);
    }

    [Fact]
    public void Multiple_source_fields_with_chained_functoids_are_applied_in_order()
    {
        var mapping = new Mapping
        {
            FieldMappings =
            [
                new FieldMapping
                {
                    TargetField = "AdSoyad",
                    SourceFields = ["Ad", "Soyad"],
                    FunctoidChain =
                    [
                        new FunctoidStep { Type = "Concat", Order = 1, Params = new Dictionary<string, object> { ["separator"] = " " } },
                        new FunctoidStep { Type = "Upper", Order = 2 },
                    ],
                },
            ],
        };

        var sourceRecord = new Dictionary<string, string?> { ["Ad"] = "ahmet", ["Soyad"] = "yilmaz" };
        var result = CreateExecutor().Apply(mapping, sourceRecord);

        Assert.Equal("AHMET YILMAZ", result["AdSoyad"]);
    }

    [Fact]
    public void Field_without_functoid_chain_is_copied_directly()
    {
        var mapping = new Mapping
        {
            FieldMappings =
            [
                new FieldMapping { TargetField = "IBAN", SourceFields = ["IBAN"], FunctoidChain = [] },
            ],
        };

        var sourceRecord = new Dictionary<string, string?> { ["IBAN"] = "TR330006100519786457841326" };
        var result = CreateExecutor().Apply(mapping, sourceRecord);

        Assert.Equal("TR330006100519786457841326", result["IBAN"]);
    }

    [Fact]
    public void Multiple_source_fields_without_functoid_chain_are_joined_with_space()
    {
        var mapping = new Mapping
        {
            FieldMappings =
            [
                new FieldMapping { TargetField = "AdSoyad", SourceFields = ["Ad", "Soyad"], FunctoidChain = [] },
            ],
        };

        var sourceRecord = new Dictionary<string, string?> { ["Ad"] = "Ahmet", ["Soyad"] = "Yilmaz" };
        var result = CreateExecutor().Apply(mapping, sourceRecord);

        Assert.Equal("Ahmet Yilmaz", result["AdSoyad"]);
    }
}
