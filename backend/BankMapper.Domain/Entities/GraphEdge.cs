using BankMapper.Domain.Enums;

namespace BankMapper.Domain.Entities;

public class GraphEdge
{
    public string Id { get; set; } = string.Empty;

    public EdgeEndpointKind FromKind { get; set; }

    // Set iff FromKind == SourceField
    public string? FromSourceSchemaId { get; set; }

    public string? FromFieldName { get; set; }

    // Set iff FromKind == NodeOutput | ConstantOutput
    public string? FromNodeId { get; set; }

    public EdgeEndpointKind ToKind { get; set; }

    // Set iff ToKind == NodeInput
    public string? ToNodeId { get; set; }

    public string? ToPort { get; set; }

    // Set iff ToKind == TargetField
    public string? ToFieldName { get; set; }
}
