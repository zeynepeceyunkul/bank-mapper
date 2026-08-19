using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Authorization;

namespace BankMapper.Api;

// [Authorize(Roles=...)]'un aksine, JWT'nin icine login aninda "damgalanmis"
// role claim'ine degil, o an Mongo'daki GERCEK role bakar - bir admin bir
// kullanicinin rolunu degistirdiginde, o kullanicinin token'i suresi
// dolmadan bile degisiklik hemen etkili olsun diye (bkz. Ece ile 2026-08-19
// tartismasi). Sadece hassas/degistirici uclarda kullaniliyor - her istekte
// bir Mongo sorgusu ekledigi icin salt-okunur (GET) uclara uygulanmiyor.
public class FreshRoleRequirement(params UserRole[] allowedRoles) : IAuthorizationRequirement
{
    public IReadOnlyCollection<UserRole> AllowedRoles { get; } = allowedRoles;
}
