using Microsoft.AspNetCore.Http;

namespace BankMapper.Api.Controllers;

public class ExecutePreviewFormRequest
{
    public string MappingId { get; set; } = string.Empty;

    public List<IFormFile> Files { get; set; } = [];

    public List<string> SourceSchemaIds { get; set; } = [];
}
