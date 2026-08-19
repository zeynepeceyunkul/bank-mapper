using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace BankMapper.Application.Auth;

public class AuthService(
    IUserRepository userRepository,
    IJwtTokenGenerator jwtTokenGenerator,
    IEmailSender emailSender) : IAuthService
{
    private const int VerificationTokenValidHours = 24;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task RegisterAsync(RegisterRequest request)
    {
        var email = NormalizeEmail(request.Email);

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new ArgumentException("Geçerli bir e-posta adresi gir.");
        }

        if (request.Password.Length < 8)
        {
            throw new ArgumentException("Şifre en az 8 karakter olmalı.");
        }

        if (request.Password != request.PasswordConfirm)
        {
            throw new ArgumentException("Şifreler eşleşmiyor.");
        }

        if (await userRepository.GetByEmailAsync(email) is not null)
        {
            throw new ArgumentException("Bu e-posta adresi zaten kayıtlı.");
        }

        var user = new User { Email = email };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        SetNewVerificationToken(user);

        await userRepository.CreateAsync(user);
        await emailSender.SendVerificationEmailAsync(user.Email, user.EmailVerificationToken!);
    }

    public async Task<LoginResult> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await userRepository.GetByEmailAsync(email);

        // Kullanici bulunamadi ve sifre yanlis durumlarini kasitli olarak
        // ayni mesajla birlestiriyoruz - hangisinin dogru oldugunu disariya
        // sizdirmamak icin (e-posta kesfi/enumeration onlemi).
        if (user is null || _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            throw new ArgumentException("E-posta veya şifre hatalı.");
        }

        if (!user.EmailVerified)
        {
            throw new ArgumentException("Önce e-postanı doğrulaman gerekiyor.");
        }

        return new LoginResult { Token = jwtTokenGenerator.GenerateToken(user), Email = user.Email };
    }

    public async Task VerifyEmailAsync(VerifyEmailRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await userRepository.GetByEmailAsync(email);

        if (user is null)
        {
            throw new ArgumentException("Doğrulama bağlantısı geçersiz.");
        }

        // Zaten dogrulanmissa sessizce basarili sayiyoruz - ayni linke iki
        // kez tiklamak (ör. e-posta istemcisinin linki onceden acmasi) hataya
        // dusmemeli.
        if (user.EmailVerified)
        {
            return;
        }

        if (user.EmailVerificationToken != request.Token
            || user.EmailVerificationTokenExpiresAt is null
            || user.EmailVerificationTokenExpiresAt < DateTime.UtcNow)
        {
            throw new ArgumentException("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
        }

        user.EmailVerified = true;
        user.EmailVerificationToken = null;
        user.EmailVerificationTokenExpiresAt = null;
        await userRepository.UpdateAsync(user);
    }

    public async Task ResendVerificationAsync(ResendVerificationRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await userRepository.GetByEmailAsync(email);

        // Hesabin var olup olmadigini ya da dogrulanmis olup olmadigini
        // disariya sizdirmiyoruz - bu metod her zaman ayni sekilde "basarili"
        // davranir (controller de her zaman ayni yaniti doner), gercek
        // gonderim sadece var olan ve henuz dogrulanmamis bir hesap icin olur.
        if (user is null || user.EmailVerified)
        {
            return;
        }

        SetNewVerificationToken(user);
        await userRepository.UpdateAsync(user);
        await emailSender.SendVerificationEmailAsync(user.Email, user.EmailVerificationToken!);
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static void SetNewVerificationToken(User user)
    {
        user.EmailVerificationToken = Guid.NewGuid().ToString("N");
        user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(VerificationTokenValidHours);
    }
}
