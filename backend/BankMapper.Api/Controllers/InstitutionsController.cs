using BankMapper.Application.Common;
using BankMapper.Application.Institutions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/institutions")]
public class InstitutionsController(IInstitutionService institutionService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<InstitutionDto>>> GetAll()
    {
        var institutions = await institutionService.GetAllAsync();
        return Ok(institutions);
    }

    [HttpGet("page")]
    public async Task<ActionResult<PagedResult<InstitutionDto>>> GetPage(
        [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 10, [FromQuery] SortOption sort = SortOption.NameAscending,
        [FromQuery] string? search = null)
    {
        var result = await institutionService.GetPagedAsync(pageIndex, pageSize, sort, search);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = "MappingManage")]
    public async Task<ActionResult<InstitutionDto>> Create(CreateInstitutionRequest request)
    {
        var created = await institutionService.CreateAsync(request);
        return Ok(created);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "MappingManage")]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await institutionService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
