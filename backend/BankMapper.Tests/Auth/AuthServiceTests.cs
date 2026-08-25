using BankMapper.Application.Abstractions;
using BankMapper.Application.Auth;
using BankMapper.Application.Common;
using BankMapper.Domain.Entities;
using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Xunit;

namespace BankMapper.Tests.Auth;

public class AuthServiceTests
{
    [Fact]
    public async Task RegisterAsync_creates_an_unverified_user_and_sends_a_verification_email()
    {
        var repository = new FakeUserRepository();
        var emailSender = new FakeEmailSender();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), emailSender);

        await service.RegisterAsync(new RegisterRequest { Email = "Ece@VakifBank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });

        var user = await repository.GetByEmailAsync("ece@vakifbank.com.tr");
        Assert.NotNull(user);
        Assert.False(user.EmailVerified);
        Assert.NotNull(user.EmailVerificationToken);
        Assert.Single(emailSender.SentTo);
        Assert.Equal("ece@vakifbank.com.tr", emailSender.SentTo[0]);
    }

    [Fact]
    public async Task RegisterAsync_rejects_an_email_thats_already_registered()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "baskaSifre1", PasswordConfirm = "baskaSifre1" }));

        Assert.Contains("zaten kayıtlı", ex.Message);
    }

    [Fact]
    public async Task RegisterAsync_rejects_a_password_shorter_than_8_characters()
    {
        var service = new AuthService(new FakeUserRepository(), new FakeJwtTokenGenerator(), new FakeEmailSender());

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "kisa1", PasswordConfirm = "kisa1" }));

        Assert.Contains("en az 8", ex.Message);
    }

    [Fact]
    public async Task RegisterAsync_rejects_mismatched_password_confirmation()
    {
        var service = new AuthService(new FakeUserRepository(), new FakeJwtTokenGenerator(), new FakeEmailSender());

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "farkliSifre1" }));

        Assert.Contains("eşleşmiyor", ex.Message);
    }

    [Fact]
    public async Task LoginAsync_succeeds_for_a_verified_user_with_the_correct_password()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await VerifyDirectlyAsync(repository, "ece@vakifbank.com.tr");

        var result = await service.LoginAsync(new LoginRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1" });

        Assert.Equal("ece@vakifbank.com.tr", result.Email);
        Assert.Equal("token-for-ece@vakifbank.com.tr", result.Token);
    }

    [Fact]
    public async Task LoginAsync_rejects_wrong_password_and_unknown_email_with_the_same_message()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await VerifyDirectlyAsync(repository, "ece@vakifbank.com.tr");

        var wrongPassword = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.LoginAsync(new LoginRequest { Email = "ece@vakifbank.com.tr", Password = "yanlisSifre" }));
        var unknownEmail = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.LoginAsync(new LoginRequest { Email = "yok@vakifbank.com.tr", Password = "hersey" }));

        Assert.Equal(wrongPassword.Message, unknownEmail.Message);
    }

    [Fact]
    public async Task LoginAsync_rejects_a_correct_password_if_the_email_is_not_verified_yet()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.LoginAsync(new LoginRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1" }));

        Assert.Contains("doğrulaman gerekiyor", ex.Message);
    }

    [Fact]
    public async Task VerifyEmailAsync_marks_the_user_verified_with_the_correct_token()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        var token = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!.EmailVerificationToken!;

        await service.VerifyEmailAsync(new VerifyEmailRequest { Email = "ece@vakifbank.com.tr", Token = token });

        var user = await repository.GetByEmailAsync("ece@vakifbank.com.tr");
        Assert.True(user!.EmailVerified);
        Assert.Null(user.EmailVerificationToken);
    }

    [Fact]
    public async Task VerifyEmailAsync_rejects_a_wrong_token()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.VerifyEmailAsync(new VerifyEmailRequest { Email = "ece@vakifbank.com.tr", Token = "yanlis-token" }));

        Assert.Contains("geçersiz", ex.Message);
    }

    [Fact]
    public async Task VerifyEmailAsync_rejects_an_expired_token()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        var user = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!;
        var token = user.EmailVerificationToken!;
        user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(-1);
        await repository.UpdateAsync(user);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.VerifyEmailAsync(new VerifyEmailRequest { Email = "ece@vakifbank.com.tr", Token = token }));

        Assert.Contains("süresi dolmuş", ex.Message);
    }

    [Fact]
    public async Task VerifyEmailAsync_is_a_no_op_when_already_verified_instead_of_throwing()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await VerifyDirectlyAsync(repository, "ece@vakifbank.com.tr");

        await service.VerifyEmailAsync(new VerifyEmailRequest { Email = "ece@vakifbank.com.tr", Token = "onemli-degil" });
    }

    [Fact]
    public async Task ResendVerificationAsync_sends_a_fresh_token_for_an_unverified_user()
    {
        var repository = new FakeUserRepository();
        var emailSender = new FakeEmailSender();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), emailSender);
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        var firstToken = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!.EmailVerificationToken;

        await service.ResendVerificationAsync(new ResendVerificationRequest { Email = "ece@vakifbank.com.tr" });

        var user = await repository.GetByEmailAsync("ece@vakifbank.com.tr");
        Assert.NotEqual(firstToken, user!.EmailVerificationToken);
        Assert.Equal(2, emailSender.SentTo.Count);
    }

    [Fact]
    public async Task ResendVerificationAsync_silently_does_nothing_for_an_unknown_email()
    {
        var emailSender = new FakeEmailSender();
        var service = new AuthService(new FakeUserRepository(), new FakeJwtTokenGenerator(), emailSender);

        await service.ResendVerificationAsync(new ResendVerificationRequest { Email = "yok@vakifbank.com.tr" });

        Assert.Empty(emailSender.SentTo);
    }

    [Fact]
    public async Task ResendVerificationAsync_silently_does_nothing_for_an_already_verified_user()
    {
        var repository = new FakeUserRepository();
        var emailSender = new FakeEmailSender();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), emailSender);
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await VerifyDirectlyAsync(repository, "ece@vakifbank.com.tr");
        emailSender.SentTo.Clear();

        await service.ResendVerificationAsync(new ResendVerificationRequest { Email = "ece@vakifbank.com.tr" });

        Assert.Empty(emailSender.SentTo);
    }

    [Fact]
    public async Task ForgotPasswordAsync_sends_a_reset_email_for_an_existing_user()
    {
        var repository = new FakeUserRepository();
        var emailSender = new FakeEmailSender();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), emailSender);
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });

        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });

        var user = await repository.GetByEmailAsync("ece@vakifbank.com.tr");
        Assert.NotNull(user!.PasswordResetToken);
        Assert.Equal(2, emailSender.SentTo.Count);
    }

    [Fact]
    public async Task ForgotPasswordAsync_silently_does_nothing_for_an_unknown_email()
    {
        var emailSender = new FakeEmailSender();
        var service = new AuthService(new FakeUserRepository(), new FakeJwtTokenGenerator(), emailSender);

        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "yok@vakifbank.com.tr" });

        Assert.Empty(emailSender.SentTo);
    }

    [Fact]
    public async Task ForgotPasswordAsync_works_for_an_unverified_user_too()
    {
        // Sifre sifirlama e-posta dogrulamayla ilgisiz bagimsiz bir islem -
        // henuz dogrulanmamis bir hesabin da sifresi "unutulmus" olabilir.
        var repository = new FakeUserRepository();
        var emailSender = new FakeEmailSender();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), emailSender);
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        emailSender.SentTo.Clear();

        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });

        Assert.Single(emailSender.SentTo);
    }

    [Fact]
    public async Task ResetPasswordAsync_changes_the_password_with_a_valid_token_and_consumes_it()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "eskiSifre1", PasswordConfirm = "eskiSifre1" });
        await VerifyDirectlyAsync(repository, "ece@vakifbank.com.tr");
        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });
        var token = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!.PasswordResetToken!;

        await service.ResetPasswordAsync(new ResetPasswordRequest { Email = "ece@vakifbank.com.tr", Token = token, Password = "yeniSifre1", PasswordConfirm = "yeniSifre1" });

        var user = await repository.GetByEmailAsync("ece@vakifbank.com.tr");
        Assert.Null(user!.PasswordResetToken);
        var loginResult = await service.LoginAsync(new LoginRequest { Email = "ece@vakifbank.com.tr", Password = "yeniSifre1" });
        Assert.Equal("ece@vakifbank.com.tr", loginResult.Email);

        // Token tek kullanimlik - ayni token'i tekrar kullanmaya calismak
        // artik "gecersiz" hatasi vermeli (VerifyEmailAsync'teki ayni tek-
        // kullanimlik desen).
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ResetPasswordAsync(new ResetPasswordRequest { Email = "ece@vakifbank.com.tr", Token = token, Password = "baskaSifre1", PasswordConfirm = "baskaSifre1" }));
        Assert.Contains("geçersiz", ex.Message);
    }

    [Fact]
    public async Task ResetPasswordAsync_rejects_a_wrong_token()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ResetPasswordAsync(new ResetPasswordRequest { Email = "ece@vakifbank.com.tr", Token = "yanlis-token", Password = "yeniSifre1", PasswordConfirm = "yeniSifre1" }));

        Assert.Contains("geçersiz", ex.Message);
    }

    [Fact]
    public async Task ResetPasswordAsync_rejects_an_expired_token()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });
        var user = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!;
        var token = user.PasswordResetToken!;
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(-1);
        await repository.UpdateAsync(user);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ResetPasswordAsync(new ResetPasswordRequest { Email = "ece@vakifbank.com.tr", Token = token, Password = "yeniSifre1", PasswordConfirm = "yeniSifre1" }));

        Assert.Contains("süresi dolmuş", ex.Message);
    }

    [Fact]
    public async Task ResetPasswordAsync_rejects_a_password_shorter_than_8_characters()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });
        var token = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!.PasswordResetToken!;

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ResetPasswordAsync(new ResetPasswordRequest { Email = "ece@vakifbank.com.tr", Token = token, Password = "kisa1", PasswordConfirm = "kisa1" }));

        Assert.Contains("en az 8", ex.Message);
    }

    [Fact]
    public async Task ResetPasswordAsync_rejects_mismatched_password_confirmation()
    {
        var repository = new FakeUserRepository();
        var service = new AuthService(repository, new FakeJwtTokenGenerator(), new FakeEmailSender());
        await service.RegisterAsync(new RegisterRequest { Email = "ece@vakifbank.com.tr", Password = "gecerliSifre1", PasswordConfirm = "gecerliSifre1" });
        await service.ForgotPasswordAsync(new ForgotPasswordRequest { Email = "ece@vakifbank.com.tr" });
        var token = (await repository.GetByEmailAsync("ece@vakifbank.com.tr"))!.PasswordResetToken!;

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ResetPasswordAsync(new ResetPasswordRequest { Email = "ece@vakifbank.com.tr", Token = token, Password = "yeniSifre1", PasswordConfirm = "farkliSifre1" }));

        Assert.Contains("eşleşmiyor", ex.Message);
    }

    private static async Task VerifyDirectlyAsync(FakeUserRepository repository, string email)
    {
        var user = (await repository.GetByEmailAsync(email))!;
        user.EmailVerified = true;
        user.EmailVerificationToken = null;
        user.EmailVerificationTokenExpiresAt = null;
        await repository.UpdateAsync(user);
    }

    private class FakeUserRepository : IUserRepository
    {
        private readonly Dictionary<string, User> _store = [];

        public Task<List<User>> GetAllAsync() => Task.FromResult(_store.Values.ToList());

        // AuthService bu metodu hic cagirmiyor - arayuzu tamamlamak icin var,
        // gercek bir davranisa ihtiyaci yok.
        public Task<(List<User> Items, long TotalCount)> GetPagedAsync(
            int pageIndex, int pageSize, SortOption sort, string? search = null, UserRole? role = null) =>
            throw new NotSupportedException("AuthServiceTests'te kullanilmiyor.");

        public Task<User?> GetByEmailAsync(string email) => Task.FromResult(_store.GetValueOrDefault(email));

        public Task<User?> GetByIdAsync(string id) => Task.FromResult(_store.Values.FirstOrDefault(u => u.Id == id));

        public Task<User> CreateAsync(User user)
        {
            user.Id = Guid.NewGuid().ToString();
            _store[user.Email] = user;
            return Task.FromResult(user);
        }

        public Task UpdateAsync(User user)
        {
            _store[user.Email] = user;
            return Task.CompletedTask;
        }
    }

    private class FakeJwtTokenGenerator : IJwtTokenGenerator
    {
        public string GenerateToken(User user) => $"token-for-{user.Email}";
    }

    private class FakeEmailSender : IEmailSender
    {
        public List<string> SentTo { get; } = [];

        public Task SendVerificationEmailAsync(string toEmail, string token)
        {
            SentTo.Add(toEmail);
            return Task.CompletedTask;
        }

        public Task SendPasswordResetEmailAsync(string toEmail, string token)
        {
            SentTo.Add(toEmail);
            return Task.CompletedTask;
        }
    }
}
