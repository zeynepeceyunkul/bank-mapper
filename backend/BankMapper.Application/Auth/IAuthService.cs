namespace BankMapper.Application.Auth;

public interface IAuthService
{
    Task RegisterAsync(RegisterRequest request);

    Task<LoginResult> LoginAsync(LoginRequest request);

    Task VerifyEmailAsync(VerifyEmailRequest request);

    Task ResendVerificationAsync(ResendVerificationRequest request);
}
