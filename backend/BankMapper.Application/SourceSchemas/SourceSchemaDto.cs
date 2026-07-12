using BankMapper.Domain.Enums;

namespace BankMapper.Application.SourceSchemas;

public class SourceSchemaDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public FileFormat FileFormat { get; set; }

    public List<SourceFieldDto> Fields { get; set; } = [];

    public SourceFormatOptionsDto FormatOptions { get; set; } = new();
}
