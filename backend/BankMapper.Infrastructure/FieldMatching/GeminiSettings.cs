namespace BankMapper.Infrastructure.FieldMatching;

public class GeminiSettings
{
    public const string SectionName = "Gemini";

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = "gemini-flash-latest";
}
