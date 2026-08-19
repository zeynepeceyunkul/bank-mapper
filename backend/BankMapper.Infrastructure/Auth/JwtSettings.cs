namespace BankMapper.Infrastructure.Auth;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    // Gemini:ApiKey ile ayni desen (bkz. GeminiSettings) - gercek deger
    // appsettings.json'a degil, dotnet user-secrets'a yazilir, git'e girmez.
    public string SigningKey { get; set; } = string.Empty;

    public string Issuer { get; set; } = "BankMapper";

    public string Audience { get; set; } = "BankMapperClient";

    public int ExpiryMinutes { get; set; } = 480;
}
