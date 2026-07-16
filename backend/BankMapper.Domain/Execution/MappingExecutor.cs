using BankMapper.Domain.Entities;
using BankMapper.Domain.Functoids;

namespace BankMapper.Domain.Execution;

public class MappingExecutor(FunctoidRegistry registry)
{
    public Dictionary<string, object?> Apply(Mapping mapping, Dictionary<string, string?> sourceRecord)
    {
        var result = new Dictionary<string, object?>();

        foreach (var fieldMapping in mapping.FieldMappings)
        {
            result[fieldMapping.TargetField] = ApplyFieldMapping(fieldMapping, sourceRecord);
        }

        return result;
    }

    private object? ApplyFieldMapping(FieldMapping fieldMapping, Dictionary<string, string?> sourceRecord)
    {
        var inputs = fieldMapping.SourceFields
            .Select(f => sourceRecord.GetValueOrDefault(f))
            .Cast<object?>()
            .ToArray();

        object? value = inputs.Length == 1 ? inputs[0] : string.Join(" ", inputs);

        var orderedChain = fieldMapping.FunctoidChain.OrderBy(f => f.Order).ToList();

        for (var i = 0; i < orderedChain.Count; i++)
        {
            var step = orderedChain[i];
            var functoid = registry.Get(step.Type);

            // Zincirin ilk adimi ham kaynak alanlarin hepsini alir (Concat gibi coklu
            // girisli functoid'ler bunu kullanir); sonraki adimlar bir onceki adimin
            // ciktisini tek girdi olarak alir (Trim, Upper gibi tekli functoid'ler icin).
            var stepInputs = i == 0 ? inputs : [value];
            value = functoid.Execute(stepInputs, step.Params);
        }

        return value;
    }
}
