using System.Net;
using System.Net.Mail;
using BankMapper.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace BankMapper.Infrastructure.Email;

public class SmtpEmailSender(IOptions<EmailSettings> settings) : IEmailSender
{
    public async Task SendVerificationEmailAsync(string toEmail, string token)
    {
        var emailSettings = settings.Value;
        var link = $"{emailSettings.FrontendBaseUrl}/verify-email?email={Uri.EscapeDataString(toEmail)}&token={token}";
        var html = $"""
            <p>Bank Mapper hesabını doğrulamak için aşağıdaki bağlantıya tıkla:</p>
            <p><a href="{link}">{link}</a></p>
            <p>Bu bağlantı 24 saat geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
            """;

        using var client = new SmtpClient(emailSettings.Host, emailSettings.Port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(emailSettings.Username, emailSettings.Password),
        };

        using var message = new MailMessage
        {
            From = new MailAddress(emailSettings.FromAddress, emailSettings.FromName),
            Subject = "Bank Mapper - E-posta Doğrulama",
            Body = html,
            IsBodyHtml = true,
        };
        message.To.Add(toEmail);

        await client.SendMailAsync(message);
    }
}
