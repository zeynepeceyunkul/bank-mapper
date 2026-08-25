namespace BankMapper.Application.Auth;

public class ResetPasswordRequest
{
    public string Email { get; set; } = string.Empty;

    public string Token { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string PasswordConfirm { get; set; } = string.Empty;
}
