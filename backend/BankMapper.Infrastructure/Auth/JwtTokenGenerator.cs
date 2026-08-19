using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BankMapper.Infrastructure.Auth;

public class JwtTokenGenerator(IOptions<JwtSettings> settings) : IJwtTokenGenerator
{
    public string GenerateToken(User user)
    {
        var jwtSettings = settings.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings.Issuer,
            audience: jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(jwtSettings.ExpiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
