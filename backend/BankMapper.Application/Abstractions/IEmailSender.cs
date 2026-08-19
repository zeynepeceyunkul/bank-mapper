namespace BankMapper.Application.Abstractions;

// Su an tek bir e-posta turu var (dogrulama linki) - link/gövde olusturma
// mantigini burada genellestirmek yerine Infrastructure tarafina birakiyoruz
// (bkz. SmtpEmailSender), boylece Application katmani frontend URL'i gibi
// dagitim ortamina ozel bir bilgiye bagimli olmuyor.
public interface IEmailSender
{
    Task SendVerificationEmailAsync(string toEmail, string token);
}
