namespace BankMapper.Application.Mappings;

public class MappingSourceSchemaDto
{
    public string SourceSchemaId { get; set; } = string.Empty;

    public string Alias { get; set; } = string.Empty;

    public string? JoinKeyField { get; set; }
}
