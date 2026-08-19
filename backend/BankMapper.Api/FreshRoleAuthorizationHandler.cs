using System.IdentityModel.Tokens.Jwt;
using BankMapper.Application.Abstractions;
using Microsoft.AspNetCore.Authorization;

namespace BankMapper.Api;

public class FreshRoleAuthorizationHandler(IUserRepository userRepository) : AuthorizationHandler<FreshRoleRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, FreshRoleRequirement requirement)
    {
        var userId = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return;
        }

        var user = await userRepository.GetByIdAsync(userId);
        if (user is not null && requirement.AllowedRoles.Contains(user.Role))
        {
            context.Succeed(requirement);
        }
    }
}
