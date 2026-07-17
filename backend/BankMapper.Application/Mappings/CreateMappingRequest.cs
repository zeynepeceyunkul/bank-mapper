namespace BankMapper.Application.Mappings;

public class CreateMappingRequest
{
    public string Name { get; set; } = string.Empty;

    public List<MappingSourceSchemaDto> SourceSchemas { get; set; } = [];

    public string FileTypeId { get; set; } = string.Empty;

    public List<FunctoidNodeDto> FunctoidNodes { get; set; } = [];

    public List<ConstantNodeDto> ConstantNodes { get; set; } = [];

    public List<GraphEdgeDto> Edges { get; set; } = [];
}
