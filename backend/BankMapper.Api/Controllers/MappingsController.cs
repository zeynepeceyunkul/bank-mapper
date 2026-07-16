using BankMapper.Application.Mappings;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/mappings")]
public class MappingsController(IMappingService mappingService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<MappingDto>>> GetAll()
    {
        var mappings = await mappingService.GetAllAsync();
        return Ok(mappings);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<MappingDto>> GetById(string id)
    {
        var mapping = await mappingService.GetByIdAsync(id);
        return mapping is null ? NotFound() : Ok(mapping);
    }

    [HttpPost]
    public async Task<ActionResult<MappingDto>> Create(CreateMappingRequest request)
    {
        try
        {
            var created = await mappingService.CreateAsync(request);
            return Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<MappingDto>> Update(string id, CreateMappingRequest request)
    {
        try
        {
            var updated = await mappingService.UpdateAsync(id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
