using System.Text.Json;
using BankMapper.Application.Common;
using BankMapper.Application.SourceSchemas;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/source-schemas")]
public class SourceSchemasController(ISourceSchemaService sourceSchemaService) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    [HttpGet]
    public async Task<ActionResult<List<SourceSchemaDto>>> GetAll()
    {
        var schemas = await sourceSchemaService.GetAllAsync();
        return Ok(schemas);
    }

    [HttpGet("page")]
    public async Task<ActionResult<PagedResult<SourceSchemaDto>>> GetPage(
        [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 10, [FromQuery] SortOption sort = SortOption.NameAscending,
        [FromQuery] string? search = null)
    {
        var result = await sourceSchemaService.GetPagedAsync(pageIndex, pageSize, sort, search);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = "MappingManage")]
    public async Task<ActionResult<SourceSchemaDto>> Create([FromForm] CreateSourceSchemaFormRequest form)
    {
        var request = new CreateSourceSchemaRequest
        {
            Name = form.Name,
            FileFormat = form.FileFormat,
            HasHeader = form.HasHeader,
            Delimiter = form.Delimiter,
            File = form.File?.OpenReadStream(),
            Fields = string.IsNullOrWhiteSpace(form.FieldsJson)
                ? null
                : JsonSerializer.Deserialize<List<SourceFieldDto>>(form.FieldsJson, JsonOptions)
        };

        var created = await sourceSchemaService.CreateAsync(request);
        return Ok(created);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "MappingManage")]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await sourceSchemaService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
