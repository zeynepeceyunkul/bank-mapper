namespace BankMapper.Application.Mappings;

public class CreateMappingRequest
{
    public string Name { get; set; } = string.Empty;

    public string SourceSchemaId { get; set; } = string.Empty;

    public string FileTypeId { get; set; } = string.Empty;

    public List<FieldMappingDto> FieldMappings { get; set; } = [];
}
