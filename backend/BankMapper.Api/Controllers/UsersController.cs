using System.IdentityModel.Tokens.Jwt;
using BankMapper.Application.Common;
using BankMapper.Application.Users;
using BankMapper.Domain.Enums;
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

    [HttpGet("page")]
    public async Task<ActionResult<PagedResult<UserDto>>> GetPage(
        [FromQuery] int pageIndex = 0, [FromQuery] int pageSize = 10, [FromQuery] SortOption sort = SortOption.NameAscending,
        [FromQuery] string? search = null, [FromQuery] UserRole? role = null)
    {
        var result = await userService.GetPagedAsync(pageIndex, pageSize, sort, search, role);
        return Ok(result);
    }

    [HttpPut("{id}/role")]
    public async Task<ActionResult<UserDto>> UpdateRole(string id, UpdateUserRoleRequest request)
    {
        var updated = await userService.UpdateRoleAsync(id, request.Role, CurrentUserId ?? string.Empty);
        return updated is null ? NotFound() : Ok(updated);
    }
}
