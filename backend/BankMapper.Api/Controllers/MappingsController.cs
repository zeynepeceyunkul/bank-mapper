using System.Security.Claims;
using BankMapper.Application.Common;
using BankMapper.Application.Mappings;
using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/mappings")]
public class MappingsController(IMappingService mappingService) : ControllerBase
{
    // CreatedBy/ApprovedBy/RejectedBy alanlarinda goruntulenebilir bir deger
    // (e-posta) tutmak icin JWT'nin "sub" (Mongo ObjectId) claim'i yerine
    // e-posta claim'i kullaniliyor - sub, FreshRoleAuthorizationHandler gibi
    // yetkilendirme amacli kod disinda insan tarafindan okunacak bir alanda
    // anlamsiz bir ObjectId string'i olarak kalirdi.
    private string? CurrentUserEmail => User.FindFirst(ClaimTypes.Email)?.Value;

    [HttpGet]
    public async Task<ActionResult<List<MappingDto>>> GetAll([FromQuery] MappingStatus? status = null, [FromQuery] string? kurumId = null)
    {
        var mappings = await mappingService.GetAllAsync(status, kurumId);
        return Ok(mappings);
    }

    // "page" ASP.NET Core routing'inde {id} parametreli rotadan daha spesifik
    // (duz metin) sayildigi icin GET /api/mappings/page her zaman buraya
    // eslesir, {id}="page" olarak GetById'ye dusme riski yok.
    [HttpGet("page")]
    public async Task<ActionResult<PagedResult<MappingDto>>> GetPage(
        [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 10, [FromQuery] SortOption sort = SortOption.RecentFirst,
        [FromQuery] string? search = null, [FromQuery] MappingStatus? status = null, [FromQuery] string? kurumId = null,
        [FromQuery] string? createdBy = null)
    {
        var result = await mappingService.GetPagedAsync(pageIndex, pageSize, sort, search, status, kurumId, createdBy);
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
        var created = await mappingService.CreateAsync(request, CurrentUserEmail);
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

    [HttpPost("{id}/approve")]
    [Authorize(Policy = "MappingApprove")]
    public async Task<ActionResult<MappingDto>> Approve(string id)
    {
        var approved = await mappingService.ApproveAsync(id, CurrentUserEmail);
        return approved is null ? NotFound() : Ok(approved);
    }

    [HttpPost("{id}/reject")]
    [Authorize(Policy = "MappingApprove")]
    public async Task<ActionResult<MappingDto>> Reject(string id, RejectMappingRequest request)
    {
        var rejected = await mappingService.RejectAsync(id, request.Reason, CurrentUserEmail);
        return rejected is null ? NotFound() : Ok(rejected);
    }
}
