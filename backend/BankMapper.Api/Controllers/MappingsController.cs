using System.IdentityModel.Tokens.Jwt;
using BankMapper.Application.Common;
using BankMapper.Application.Mappings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/mappings")]
public class MappingsController(IMappingService mappingService) : ControllerBase
{
    private string? CurrentUserId => User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

    [HttpGet]
    public async Task<ActionResult<List<MappingDto>>> GetAll()
    {
        var mappings = await mappingService.GetAllAsync();
        return Ok(mappings);
    }

    // "page" ASP.NET Core routing'inde {id} parametreli rotadan daha spesifik
    // (duz metin) sayildigi icin GET /api/mappings/page her zaman buraya
    // eslesir, {id}="page" olarak GetById'ye dusme riski yok.
    [HttpGet("page")]
    public async Task<ActionResult<PagedResult<MappingDto>>> GetPage(
        [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 10, [FromQuery] SortOption sort = SortOption.RecentFirst,
        [FromQuery] string? search = null)
    {
        var result = await mappingService.GetPagedAsync(pageIndex, pageSize, sort, search);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<MappingDto>> GetById(string id)
    {
        var mapping = await mappingService.GetByIdAsync(id);
        return mapping is null ? NotFound() : Ok(mapping);
    }

    [HttpPost]
    [Authorize(Policy = "MappingManage")]
    public async Task<ActionResult<MappingDto>> Create(CreateMappingRequest request)
    {
        var created = await mappingService.CreateAsync(request, CurrentUserId);
        return Ok(created);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "MappingManage")]
    public async Task<ActionResult<MappingDto>> Update(string id, CreateMappingRequest request)
    {
        var updated = await mappingService.UpdateAsync(id, request);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "MappingManage")]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await mappingService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
