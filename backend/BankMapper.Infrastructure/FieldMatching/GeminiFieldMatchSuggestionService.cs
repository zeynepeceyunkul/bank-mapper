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

        var responseJson = await SendWithRetryAsync(url, content);
        return ParseSuggestions(responseJson, sourceFieldNames, targetFieldNames);
    }

    // Gemini (ozellikle ucretsiz katmanda) ara sira tek seferlik gecici bir
    // yavaslik/hata gosterebiliyor - zaman asimina ugrayip 20s Timeout'a takilan
    // ya da 429/5xx donen bir cagriyi bir kez daha deniyoruz, boylece kullanici
    // manuel "tekrar dene"ye basmak zorunda kalmiyor. Gercek istek hatalari
    // (401/400 gibi) tekrar denemeden hemen firlatiliyor - tekrar denemek onlari
    // duzeltmez, sadece gecikmeyi ikiye katlar.
    private async Task<string> SendWithRetryAsync(string url, HttpContent content)
    {
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            HttpResponseMessage response;
            try
            {
                response = await httpClient.PostAsync(url, content);
            }
            catch (TaskCanceledException) when (attempt == 1)
            {
                await Task.Delay(500);
                continue;
            }

            using (response)
            {
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsStringAsync();
                }

                var errorBody = await response.Content.ReadAsStringAsync();
                if (attempt == 1 && IsTransientStatusCode(response.StatusCode))
                {
                    await Task.Delay(500);
                    continue;
                }

                throw new InvalidOperationException($"Gemini API hata dondurdu: {(int)response.StatusCode} - {errorBody}");
            }
        }

        // Buraya sadece 2. deneme de zaman asimina ugrarsa (TaskCanceledException)
        // ulasilir - o durumda catch filtresi (attempt == 1) devreye girmedigi icin
        // istisna zaten yukari firladi, bu satira asla fiilen erisilmez.
        throw new InvalidOperationException("Gemini API'den yanit alinamadi.");
    }

    private static bool IsTransientStatusCode(System.Net.HttpStatusCode statusCode) =>
        statusCode == System.Net.HttpStatusCode.TooManyRequests || (int)statusCode >= 500;

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
