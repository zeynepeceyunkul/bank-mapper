namespace BankMapper.Application.Mappings;

public class FieldMappingDto
{
    public string TargetField { get; set; } = string.Empty;

    public List<string> SourceFields { get; set; } = [];

    public List<FunctoidStepDto> FunctoidChain { get; set; } = [];
}
