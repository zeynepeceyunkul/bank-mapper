using System.Net;
using System.Net.Mail;
using BankMapper.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace BankMapper.Infrastructure.Email;

public class SmtpEmailSender(IOptions<EmailSettings> settings) : IEmailSender
{
    public Task SendVerificationEmailAsync(string toEmail, string token)
    {
        var link = $"{settings.Value.FrontendBaseUrl}/verify-email?email={Uri.EscapeDataString(toEmail)}&token={token}";
        var html = $"""
            <p>Bank Mapper hesabını doğrulamak için aşağıdaki bağlantıya tıkla:</p>
            <p><a href="{link}">{link}</a></p>
            <p>Bu bağlantı 24 saat geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
            """;
        return SendAsync(toEmail, "Bank Mapper - E-posta Doğrulama", html);
    }

    // Sifre sifirlama linki dogrulama linkinden KISA omurlu (1 saat, 24 saat
    // degil) - bu token sadece e-posta sahipligini degil, dogrudan hesaba
    // TAM ERISIMI (yeni sifre belirleme) veriyor, bu yuzden ele gecirilme
    // penceresi daha dar tutulmali (bkz. AuthService.PasswordResetTokenValidHours).
    public Task SendPasswordResetEmailAsync(string toEmail, string token)
    {
        var link = $"{settings.Value.FrontendBaseUrl}/reset-password?email={Uri.EscapeDataString(toEmail)}&token={token}";
        var html = $"""
            <p>Bank Mapper hesabının şifresini sıfırlamak için aşağıdaki bağlantıya tıkla:</p>
            <p><a href="{link}">{link}</a></p>
            <p>Bu bağlantı 1 saat geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin, şifren değişmez.</p>
            """;
        return SendAsync(toEmail, "Bank Mapper - Şifre Sıfırlama", html);
    }

    private async Task SendAsync(string toEmail, string subject, string html)
    {
        var emailSettings = settings.Value;

        using var client = new SmtpClient(emailSettings.Host, emailSettings.Port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(emailSettings.Username, emailSettings.Password),
        };

        using var message = new MailMessage
        {
            From = new MailAddress(emailSettings.FromAddress, emailSettings.FromName),
            Subject = subject,
            Body = html,
            IsBodyHtml = true,
        };
        message.To.Add(toEmail);

        await client.SendMailAsync(message);
    }
}
