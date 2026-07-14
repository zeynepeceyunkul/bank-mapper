namespace BankMapper.Application.Mappings;

public class MappingDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string SourceSchemaId { get; set; } = string.Empty;

    public string FileTypeId { get; set; } = string.Empty;

    public List<FieldMappingDto> FieldMappings { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? CreatedBy { get; set; }
}
