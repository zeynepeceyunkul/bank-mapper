using BankMapper.Domain.Enums;

namespace BankMapper.Application.RunHistory;

public class MappingRunDto
{
    public string Id { get; set; } = string.Empty;

    public string MappingId { get; set; } = string.Empty;

    public string MappingName { get; set; } = string.Empty;

    public RunKind Kind { get; set; }

    public List<string> FileNames { get; set; } = [];

    public bool Success { get; set; }

    public int? RowCount { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime RunAt { get; set; }
}
