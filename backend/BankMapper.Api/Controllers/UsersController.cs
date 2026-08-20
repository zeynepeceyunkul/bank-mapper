using System.IdentityModel.Tokens.Jwt;
using BankMapper.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = "UserManage")]
public class UsersController(IUserService userService) : ControllerBase
{
    // MappingsController'daki CurrentUserEmail'in aksine burada id lazim -
    // "kendi rolunu degistiremezsin" kontrolu id karsilastirmasi yapiyor.
    private string? CurrentUserId => User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetAll()
    {
        var users = await userService.GetAllAsync();
        return Ok(users);
    }

    [HttpPut("{id}/role")]
    public async Task<ActionResult<UserDto>> UpdateRole(string id, UpdateUserRoleRequest request)
    {
        var updated = await userService.UpdateRoleAsync(id, request.Role, CurrentUserId ?? string.Empty);
        return updated is null ? NotFound() : Ok(updated);
    }
}
