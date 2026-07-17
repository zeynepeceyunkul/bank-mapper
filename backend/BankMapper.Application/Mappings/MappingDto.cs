namespace BankMapper.Application.Mappings;

public class MappingDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<MappingSourceSchemaDto> SourceSchemas { get; set; } = [];

    public string FileTypeId { get; set; } = string.Empty;

    public List<FunctoidNodeDto> FunctoidNodes { get; set; } = [];

    public List<ConstantNodeDto> ConstantNodes { get; set; } = [];

    public List<GraphEdgeDto> Edges { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? CreatedBy { get; set; }
}
