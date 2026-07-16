using BankMapper.Application.FileTypes;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/file-types")]
public class FileTypesController(IFileTypeService fileTypeService) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<ActionResult<FileTypeDto>> GetById(string id)
    {
        var fileType = await fileTypeService.GetByIdAsync(id);
        return fileType is null ? NotFound() : Ok(fileType);
    }
}
