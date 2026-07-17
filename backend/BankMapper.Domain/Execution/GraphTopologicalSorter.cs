using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Domain.Execution;

public static class GraphTopologicalSorter
{
    // Node-to-node dependency arcs are edges where a functoid's output feeds another
    // functoid's input; source fields and constants have no dependencies (always available).
    public static List<string> Sort(Mapping mapping)
    {
        var nodeIds = mapping.FunctoidNodes.Select(n => n.Id).ToList();

        var dependencyEdges = mapping.Edges
            .Where(e => e.FromKind == EdgeEndpointKind.NodeOutput && e.ToKind == EdgeEndpointKind.NodeInput)
            .ToList();

        var inDegree = nodeIds.ToDictionary(id => id, _ => 0);
        foreach (var edge in dependencyEdges)
        {
            if (inDegree.ContainsKey(edge.ToNodeId!))
            {
                inDegree[edge.ToNodeId!]++;
            }
        }

        var queue = new Queue<string>(nodeIds.Where(id => inDegree[id] == 0));
        var order = new List<string>();

        while (queue.Count > 0)
        {
            var nodeId = queue.Dequeue();
            order.Add(nodeId);

            foreach (var edge in dependencyEdges.Where(e => e.FromNodeId == nodeId))
            {
                inDegree[edge.ToNodeId!]--;
                if (inDegree[edge.ToNodeId!] == 0)
                {
                    queue.Enqueue(edge.ToNodeId!);
                }
            }
        }

        if (order.Count != nodeIds.Count)
        {
            throw new InvalidOperationException("Functoid grafiğinde döngü tespit edildi.");
        }

        return order;
    }
}
