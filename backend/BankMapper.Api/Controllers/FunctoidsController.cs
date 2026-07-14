using BankMapper.Application.Functoids;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/functoids")]
public class FunctoidsController(IFunctoidService functoidService) : ControllerBase
{
    [HttpGet]
    public ActionResult<List<FunctoidDto>> GetAll() => Ok(functoidService.GetAll());
}
