using Microsoft.AspNetCore.Http;

namespace BankMapper.Api.Controllers;

public class ExecutePreviewFormRequest
{
    public string MappingId { get; set; } = string.Empty;

    public IFormFile? File { get; set; }
}
