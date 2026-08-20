using BankMapper.Application.Abstractions;
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
