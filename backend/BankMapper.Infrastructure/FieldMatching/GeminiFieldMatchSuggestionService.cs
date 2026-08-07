using System.Text;
using System.Text.Json;
using BankMapper.Application.FieldMatching;
using BankMapper.Domain.Functoids;
using Microsoft.Extensions.Options;

namespace BankMapper.Infrastructure.FieldMatching;

public class GeminiFieldMatchSuggestionService(HttpClient httpClient, IOptions<GeminiSettings> settings, FunctoidRegistry functoidRegistry) : IFieldMatchSuggestionService
{
    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    // Su an icin sadece Concat destekleniyor (kapsam karari - bkz. proje plani):
    // isim-tabanli/yapisal bir karar (Ad+Soyad->AdSoyad), gercek veriye bakmadan
    // tahmin gerektiren Trim/Upper/Lower/LPad/RPad bilincli olarak disarida.
    private const string SupportedCombineFunctoidCode = "Concat";

    public async Task<List<FieldMatchSuggestion>> SuggestAsync(List<string> sourceFieldNames, List<string> targetFieldNames)
    {
        if (sourceFieldNames.Count == 0 || targetFieldNames.Count == 0)
        {
            return [];
        }

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{settings.Value.Model}:generateContent?key={settings.Value.ApiKey}";
        using var content = new StringContent(JsonSerializer.Serialize(BuildRequestBody(sourceFieldNames, targetFieldNames)), Encoding.UTF8, "application/json");
        using var response = await httpClient.PostAsync(url, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Gemini API hata dondurdu: {(int)response.StatusCode} - {errorBody}");
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        return ParseSuggestions(responseJson, sourceFieldNames, targetFieldNames);
    }

    private static object BuildRequestBody(List<string> sourceFieldNames, List<string> targetFieldNames)
    {
        var prompt =
            "Asagida bir dosya donusturme aracinin kaynak ve hedef alan adlari listeleniyor. " +
            "Anlam olarak birbirine karsilik gelen alan ciftlerini bul (orn. 'IBAN' ile 'IBAN', 'TC' ile 'TCKimlikNo'). " +
            "Sadece emin oldugun eslesmeleri don, supheliyse o kaynak alani atla. " +
            "Bir kaynak ya da hedef alani en fazla bir eslesmede kullan.\n\n" +
            "Ayrica, iki kaynak alan isim olarak birlestiginde bir hedef alana karsilik " +
            "geliyorsa (orn. 'Ad' ve 'Soyad' -> 'AdSoyad') bunu da onerebilirsin: bu " +
            "durumda sourceFields alanina o iki kaynak alani, functoidCode alanina tam " +
            "olarak \"Concat\" yaz. Sadece bu iki durumda oneri ver (tek alan eslesmesi " +
            "ya da iki alani birlestiren Concat), baska hicbir functoid kullanma. Tek " +
            "alan eslesmelerinde functoidCode alanini bos birak.\n\n" +
            $"Kaynak alanlar: {string.Join(", ", sourceFieldNames)}\n" +
            $"Hedef alanlar: {string.Join(", ", targetFieldNames)}";

        return new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new
            {
                responseMimeType = "application/json",
                responseSchema = new
                {
                    type = "ARRAY",
                    items = new
                    {
                        type = "OBJECT",
                        properties = new
                        {
                            sourceFields = new { type = "ARRAY", items = new { type = "STRING" } },
                            targetField = new { type = "STRING" },
                            functoidCode = new { type = "STRING" },
                        },
                        required = new[] { "sourceFields", "targetField" },
                    },
                },
            },
        };
    }

    private List<FieldMatchSuggestion> ParseSuggestions(
        string responseJson, List<string> sourceFieldNames, List<string> targetFieldNames)
    {
        using var doc = JsonDocument.Parse(responseJson);
        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? "[]";

        var raw = JsonSerializer.Deserialize<List<FieldMatchSuggestion>>(text, CaseInsensitive) ?? [];

        var concatArity = functoidRegistry.Get(SupportedCombineFunctoidCode).InputPorts.Count;

        // Modelin istekte hic olmayan bir alan adi "uydurma" ihtimaline karsi
        // (LLM halisünasyonu) - sadece gercekten gonderdigimiz listelerde olan
        // alanlari, ve sadece bildigimiz iki eslesme seklini (direkt 1:1 ya da
        // gercek arity'sine uyan Concat) kabul ediyoruz.
        return raw
            .Where(s =>
                s.SourceFields.Count > 0 &&
                s.SourceFields.All(sourceFieldNames.Contains) &&
                targetFieldNames.Contains(s.TargetField) &&
                IsSupportedShape(s, concatArity))
            .ToList();
    }

    private static bool IsSupportedShape(FieldMatchSuggestion s, int concatArity) =>
        string.IsNullOrEmpty(s.FunctoidCode)
            ? s.SourceFields.Count == 1
            : s.FunctoidCode == SupportedCombineFunctoidCode && s.SourceFields.Count == concatArity;
}
