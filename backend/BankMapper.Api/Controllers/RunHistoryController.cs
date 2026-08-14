using BankMapper.Application.Common;
using BankMapper.Application.RunHistory;
using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/run-history")]
public class RunHistoryController(IRunHistoryService runHistoryService) : ControllerBase
{
    [HttpGet("page")]
    public async Task<ActionResult<PagedResult<MappingRunDto>>> GetPage(
        [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 10,
        [FromQuery] RunKind? kind = null, [FromQuery] bool? success = null)
    {
        var result = await runHistoryService.GetPagedAsync(pageIndex, pageSize, kind, success);
        return Ok(result);
    }
}
