namespace BankMapper.Infrastructure.Email;

// Genel SMTP ayarlari - herhangi bir SMTP saglayicisiyla calisir (Brevo,
// SendGrid, bankanin kendi mail sunucusu vb.), kod hicbirine ozel degil.
// Sadece bu degerler (appsettings + user-secrets) degisiyor, kod ayni kaliyor.
public class EmailSettings
{
    public const string SectionName = "Email";

    public string Host { get; set; } = string.Empty;

    public int Port { get; set; } = 587;

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string FromAddress { get; set; } = string.Empty;

    public string FromName { get; set; } = "Bank Mapper";

    // Dogrulama linki bu adrese ekleniyor - Angular uygulamasinin adresi
    // (dev'de localhost:4200, canliya gecince gercek domain ile degisecek).
    public string FrontendBaseUrl { get; set; } = "http://localhost:4200";
}
