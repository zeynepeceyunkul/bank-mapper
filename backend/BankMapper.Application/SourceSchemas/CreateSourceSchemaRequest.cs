using BankMapper.Domain.Enums;

namespace BankMapper.Application.SourceSchemas;

public class CreateSourceSchemaRequest
{
    public string Name { get; set; } = string.Empty;

    public FileFormat FileFormat { get; set; }

    public bool HasHeader { get; set; }

    public string? Delimiter { get; set; }

    /// <summary>Excel/CSV icin: alanlar bu dosyanin header'indan otomatik algilanir.</summary>
    public Stream? File { get; set; }

    /// <summary>Fixed-Length icin: alan pozisyonlari kullanici tarafindan manuel tanimlanir.</summary>
    public List<SourceFieldDto>? Fields { get; set; }
}
