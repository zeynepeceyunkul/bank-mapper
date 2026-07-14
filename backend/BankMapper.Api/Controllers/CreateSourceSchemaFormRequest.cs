using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace BankMapper.Api.Controllers;

public class CreateSourceSchemaFormRequest
{
    public string Name { get; set; } = string.Empty;

    public FileFormat FileFormat { get; set; }

    public bool HasHeader { get; set; }

    public string? Delimiter { get; set; }

    public IFormFile? File { get; set; }

    /// <summary>Fixed-Length icin JSON dizi: [{ "name": "...", "type": "...", "order": 1, "startIndex": 0, "length": 11 }]</summary>
    public string? FieldsJson { get; set; }
}
