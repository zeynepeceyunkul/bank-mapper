using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Execution;
using BankMapper.Domain.Functoids;
using Xunit;

namespace BankMapper.Tests.Execution;

public class MappingExecutorTests
{
    private const string SchemaId = "src1";

    private static MappingExecutor CreateExecutor() => new(new FunctoidRegistry(
    [
        new TrimFunctoid(),
        new UpperFunctoid(),
        new LowerFunctoid(),
        new ConcatFunctoid(),
        new LPadFunctoid(),
        new RPadFunctoid(),
    ]));

    private static Dictionary<string, string?> Record(params (string field, string? value)[] fields) =>
        fields.ToDictionary(f => SourceFieldKey.Build(SchemaId, f.field), f => f.value);

    [Fact]
    public void Single_source_field_with_single_functoid_is_applied()
    {
        var mapping = new Mapping
        {
            FunctoidNodes = [new FunctoidNode { Id = "n1", FunctoidCode = "LPad", Params = new Dictionary<string, object> { ["length"] = 11, ["padChar"] = "0" } }],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "TC", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value" },
                new GraphEdge { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n1", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "TCKimlikNo" },
            ],
        };

        var result = CreateExecutor().Apply(mapping, Record(("TC", "123")));

        Assert.Equal("00000000123", result["TCKimlikNo"]);
    }

    [Fact]
    public void Multiple_source_fields_with_chained_functoids_are_applied_in_order()
    {
        var mapping = new Mapping
        {
            FunctoidNodes =
            [
                new FunctoidNode { Id = "concat1", FunctoidCode = "Concat", Params = new Dictionary<string, object> { ["separator"] = " " } },
                new FunctoidNode { Id = "upper1", FunctoidCode = "Upper" },
            ],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "concat1", ToPort = "value1" },
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Soyad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "concat1", ToPort = "value2" },
                new GraphEdge { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "concat1", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "upper1", ToPort = "value" },
                new GraphEdge { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "upper1", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "AdSoyad" },
            ],
        };

        var result = CreateExecutor().Apply(mapping, Record(("Ad", "ahmet"), ("Soyad", "yilmaz")));

        Assert.Equal("AHMET YILMAZ", result["AdSoyad"]);
    }

    [Fact]
    public void Field_without_functoid_chain_is_copied_directly()
    {
        var mapping = new Mapping
        {
            Edges = [new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "IBAN", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "IBAN" }],
        };

        var result = CreateExecutor().Apply(mapping, Record(("IBAN", "TR330006100519786457841326")));

        Assert.Equal("TR330006100519786457841326", result["IBAN"]);
    }

    [Fact]
    public void Constant_node_output_can_feed_a_target_field()
    {
        var mapping = new Mapping
        {
            ConstantNodes = [new ConstantNode { Id = "c1", Value = "ZZZ" }],
            Edges = [new GraphEdge { FromKind = EdgeEndpointKind.ConstantOutput, FromNodeId = "c1", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "UlkeKodu" }],
        };

        var result = CreateExecutor().Apply(mapping, Record());

        Assert.Equal("ZZZ", result["UlkeKodu"]);
    }

    [Fact]
    public void Single_source_field_can_fan_out_into_two_nodes_that_both_feed_a_third_node()
    {
        // Diamond: "Ad" -> Trim(n1) -\
        //                             > Concat(n3, separator="-") -> Sonuc
        // "Ad" -> Upper(n2) -/
        // Bu, dogrusal zincir modelinde ifade edilemeyen gercek bir graph baglantisi.
        var mapping = new Mapping
        {
            FunctoidNodes =
            [
                new FunctoidNode { Id = "n1", FunctoidCode = "Trim" },
                new FunctoidNode { Id = "n2", FunctoidCode = "Upper" },
                new FunctoidNode { Id = "n3", FunctoidCode = "Concat", Params = new Dictionary<string, object> { ["separator"] = "-" } },
            ],
            Edges =
            [
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n1", ToPort = "value" },
                new GraphEdge { FromKind = EdgeEndpointKind.SourceField, FromSourceSchemaId = SchemaId, FromFieldName = "Ad", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n2", ToPort = "value" },
                new GraphEdge { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n1", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n3", ToPort = "value1" },
                new GraphEdge { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n2", ToKind = EdgeEndpointKind.NodeInput, ToNodeId = "n3", ToPort = "value2" },
                new GraphEdge { FromKind = EdgeEndpointKind.NodeOutput, FromNodeId = "n3", ToKind = EdgeEndpointKind.TargetField, ToFieldName = "Sonuc" },
            ],
        };

        var result = CreateExecutor().Apply(mapping, Record(("Ad", "ahmet")));

        Assert.Equal("ahmet-AHMET", result["Sonuc"]);
    }
}
