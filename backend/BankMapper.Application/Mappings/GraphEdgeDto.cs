using BankMapper.Domain.Enums;

namespace BankMapper.Application.Mappings;

public class GraphEdgeDto
{
    public string Id { get; set; } = string.Empty;

    public EdgeEndpointKind FromKind { get; set; }

    public string? FromSourceSchemaId { get; set; }

    public string? FromFieldName { get; set; }

    public string? FromNodeId { get; set; }

    public EdgeEndpointKind ToKind { get; set; }

    public string? ToNodeId { get; set; }

    public string? ToPort { get; set; }

    public string? ToFieldName { get; set; }
}
