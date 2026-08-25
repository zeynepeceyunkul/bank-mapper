using BankMapper.Application.Abstractions;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;

namespace BankMapper.Application.Users;

public class UserService(IUserRepository repository) : IUserService
{
    public async Task<List<UserDto>> GetAllAsync()
    {
        var users = await repository.GetAllAsync();
        // Auth yeniden yazilmadan onceki eski semadan kalma, e-postasi olmayan
        // kayitlar (bkz. User.cs'teki [BsonIgnoreExtraElements] yorumu) bos bir
        // satir olarak listede gorunmesin diye eleniyor - gercek bir kullanici
        // degiller, silinmemis eski veri.
        return users.Where(u => !string.IsNullOrEmpty(u.Email)).Select(ToDto).ToList();
    }

    public async Task<PagedResult<UserDto>> GetPagedAsync(int pageIndex, int pageSize, SortOption sort, string? search = null, UserRole? role = null)
    {
        var clampedPageIndex = Math.Max(pageIndex, 0);
        var clampedPageSize = Math.Clamp(pageSize, 1, 100);

        var (items, totalCount) = await repository.GetPagedAsync(clampedPageIndex, clampedPageSize, sort, search, role);
        return new PagedResult<UserDto> { Items = items.Select(ToDto).ToList(), TotalCount = totalCount };
    }

    public async Task<UserDto?> UpdateRoleAsync(string id, UserRole role, string currentUserId)
    {
        var existing = await repository.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        // Ece'nin karari (2026-08-20, Faz 5): bir Admin kendi rolunu bu
        // ekrandan degistiremesin - yanlislikla kendini Admin'likten
        // dusurup kilitli kalma riskini onlemek icin. Frontend zaten
        // kendi satirindaki kontrolu devre disi birakiyor, ama bu sadece
        // UI - gercek kisitlama burada (biri URL/DevTools ile deneyebilir).
        if (id == currentUserId)
        {
            throw new ArgumentException("Kendi rolünüzü değiştiremezsiniz.");
        }

        // Ece'nin karari (2026-08-25): tek bir SuperAdmin olacak, bu rol
        // uygulama uzerinden kimseye atanamaz - yukaridaki "kendi rolunu
        // degistiremezsin" kontroluyle birlesince (SuperAdmin'in TEK erisimi
        // olan UserManage policy'sini kendi hesabina uygulayamamasi), bu satir
        // rolun sonsuza kadar tek ve degismez kalmasini garanti ediyor.
        if (role == UserRole.SuperAdmin)
        {
            throw new ArgumentException("Süper Admin rolü uygulama üzerinden atanamaz.");
        }

        existing.Role = role;
        await repository.UpdateAsync(existing);
        return ToDto(existing);
    }

    private static UserDto ToDto(User user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        Role = user.Role,
        EmailVerified = user.EmailVerified
    };
}
