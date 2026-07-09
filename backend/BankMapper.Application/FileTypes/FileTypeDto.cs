namespace BankMapper.Application.FileTypes;

public class FileTypeDto
{
    public string Id { get; set; } = string.Empty;

    public string ProductId { get; set; } = string.Empty;

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<TargetFieldDto> TargetFields { get; set; } = [];
}
