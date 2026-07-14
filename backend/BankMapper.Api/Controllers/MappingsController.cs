using BankMapper.Application.Mappings;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/mappings")]
public class MappingsController(IMappingService mappingService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MappingDto>> Create(CreateMappingRequest request)
    {
        var created = await mappingService.CreateAsync(request);
        return Ok(created);
    }
}
