using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using BankMapper.Domain.Functoids;

namespace BankMapper.Domain.Execution;

public class MappingExecutor(FunctoidRegistry registry)
{
    public Dictionary<string, object?> Apply(Mapping mapping, Dictionary<string, string?> sourceRecord)
    {
        var order = GraphTopologicalSorter.Sort(mapping);
        var nodeOutputs = new Dictionary<string, object?>();

        foreach (var nodeId in order)
        {
            var node = mapping.FunctoidNodes.First(n => n.Id == nodeId);
            var functoid = registry.Get(node.FunctoidCode);

            var inputs = functoid.InputPorts
                .Select(port => ResolveNodeInput(mapping, nodeId, port, sourceRecord, nodeOutputs))
                .ToArray();

            nodeOutputs[nodeId] = functoid.Execute(inputs, node.Params);
        }

        var result = new Dictionary<string, object?>();
        foreach (var edge in mapping.Edges.Where(e => e.ToKind == EdgeEndpointKind.TargetField))
        {
            result[edge.ToFieldName!] = ResolveEdgeSourceValue(edge, sourceRecord, nodeOutputs, mapping);
        }

        return result;
    }

    private static object? ResolveNodeInput(
        Mapping mapping,
        string nodeId,
        string port,
        Dictionary<string, string?> sourceRecord,
        Dictionary<string, object?> nodeOutputs)
    {
        var edge = mapping.Edges.FirstOrDefault(e =>
            e.ToKind == EdgeEndpointKind.NodeInput && e.ToNodeId == nodeId && e.ToPort == port);

        return edge is null ? null : ResolveEdgeSourceValue(edge, sourceRecord, nodeOutputs, mapping);
    }

    private static object? ResolveEdgeSourceValue(
        GraphEdge edge,
        Dictionary<string, string?> sourceRecord,
        Dictionary<string, object?> nodeOutputs,
        Mapping mapping) => edge.FromKind switch
    {
        EdgeEndpointKind.SourceField => sourceRecord.GetValueOrDefault(
            SourceFieldKey.Build(edge.FromSourceSchemaId!, edge.FromFieldName!)),
        EdgeEndpointKind.NodeOutput => nodeOutputs.GetValueOrDefault(edge.FromNodeId!),
        EdgeEndpointKind.ConstantOutput => mapping.ConstantNodes.First(c => c.Id == edge.FromNodeId).Value,
        _ => null,
    };
}
