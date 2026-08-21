using System.Text;
using System.Text.Json;
using BankMapper.Application.FieldMatching;
using BankMapper.Domain.Functoids;
using Microsoft.Extensions.Options;

namespace BankMapper.Infrastructure.FieldMatching;

public class GeminiFieldMatchSuggestionService(HttpClient httpClient, IOptions<GeminiSettings> settings, FunctoidRegistry functoidRegistry) : IFieldMatchSuggestionService
{
    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    // Concat: isim-tabanli/yapisal bir karar (Ad+Soyad->AdSoyad), gercek veriye
    // bakmadan verilebilir. LPad/RPad de ayni sekilde isimden karar verilebiliyor
    // (orn. "TCKimlikNo" gibi sabit uzunluklu bir ID alani) - ama uzunluk parametresi
    // AI'den DEGIL, TargetField.Length'ten (bkz. ParseSuggestions) geliyor, ve her
    // ikisi de kabul edildiginde onlerine otomatik bir Trim zincirlenir (bkz. proje
    // karari - MappingExecutor Length asimini gercek bir hata olarak firlatiyor,
    // trimlenmemis bosluk pad'i yanlis/fazla uzun yapabilir). Upper/Lower bilincli
    // olarak disarida - veri kalitesi karari, isimden guvenilir cikarilamiyor.
    private static readonly HashSet<string> AllowedFunctoidCodes = ["Concat", "LPad", "RPad"];
    private const string DefaultPadChar = "0";

    public async Task<List<FieldMatchSuggestion>> SuggestAsync(List<string> sourceFieldNames, List<TargetFieldInfo> targetFields)
    {
        if (sourceFieldNames.Count == 0 || targetFields.Count == 0)
        {
            return [];
        }

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{settings.Value.Model}:generateContent?key={settings.Value.ApiKey}";
        using var content = new StringContent(JsonSerializer.Serialize(BuildRequestBody(sourceFieldNames, targetFields)), Encoding.UTF8, "application/json");

        var responseJson = await SendWithRetryAsync(url, content);
        return ParseSuggestions(responseJson, sourceFieldNames, targetFields);
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

    private static object BuildRequestBody(List<string> sourceFieldNames, List<TargetFieldInfo> targetFields)
    {
        // Hedef alanlar sadece isim degil, varsa uzunlugu da iceriyor (orn.
        // "TCKimlikNo (11)") - LPad/RPad onerisi bu bilgiye dayaniyor, ama
        // asagidaki talimat modelin bir uzunluk DEGERI DONDURMESINI degil, sadece
        // "bu alan sabit uzunluklu, doldurma gerekebilir mi" kararini vermesini
        // istiyor - gercek uzunluk her zaman bizim tarafimizdan (ParseSuggestions)
        // TargetField.Length'ten uygulaniyor, modele guvenilmiyor.
        var targetFieldDescriptions = targetFields.Select(f =>
            f.Length.HasValue ? $"{f.Name} ({f.Length})" : f.Name);

        var prompt =
            "Asagida bir dosya donusturme aracinin kaynak ve hedef alan adlari listeleniyor " +
            "(hedef alanlarda parantez icindeki sayi, o alanin sabit karakter uzunlugu). " +
            "Anlam olarak birbirine karsilik gelen alan ciftlerini bul (orn. 'IBAN' ile 'IBAN', 'TC' ile 'TCKimlikNo'). " +
            "Sadece emin oldugun eslesmeleri don, supheliyse o kaynak alani atla. " +
            "Bir kaynak ya da hedef alani en fazla bir eslesmede kullan.\n\n" +
            "Ayrica, iki kaynak alan isim olarak birlestiginde bir hedef alana karsilik " +
            "geliyorsa (orn. 'Ad' ve 'Soyad' -> 'AdSoyad') bunu da onerebilirsin: bu " +
            "durumda sourceFields alanina o iki kaynak alani, functoidCode alanina tam " +
            "olarak \"Concat\" yaz.\n\n" +
            "Ayrica, bir kaynak alan anlam olarak sabit uzunluklu bir hedef alana " +
            "karsilik geliyorsa ama kaynaktaki degerin uzunlugu farkli olabilecegi " +
            "icin (orn. bir kimlik/hesap numarasi) doldurma (padding) gerekebilecegini " +
            "dusunuyorsan bunu da onerebilirsin: bu durumda sourceFields alanina o tek " +
            "kaynak alani, functoidCode alanina \"LPad\" (sola doldurma, sayisal " +
            "ID'ler icin tipik) ya da \"RPad\" (saga doldurma) yaz, padChar alanina da " +
            "uygun tek karakterlik dolgu karakterini yaz (sayisal ID'ler icin genelde " +
            "\"0\"). Uzunluk degerini SEN HESAPLAMA, biz zaten hedef alanin kendi " +
            "uzunlugunu kullanacagiz.\n\n" +
            "Sadece bu uc durumda oneri ver (tek alan eslesmesi, iki alani birlestiren " +
            "Concat, ya da tek alani dolduran LPad/RPad), baska hicbir functoid " +
            "kullanma. Tek alan eslesmelerinde functoidCode alanini bos birak.\n\n" +
            $"Kaynak alanlar: {string.Join(", ", sourceFieldNames)}\n" +
            $"Hedef alanlar: {string.Join(", ", targetFieldDescriptions)}";

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
                            padChar = new { type = "STRING" },
                        },
                        required = new[] { "sourceFields", "targetField" },
                    },
                },
            },
        };
    }

    private List<FieldMatchSuggestion> ParseSuggestions(
        string responseJson, List<string> sourceFieldNames, List<TargetFieldInfo> targetFields)
    {
        using var doc = JsonDocument.Parse(responseJson);
        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? "[]";

        var raw = JsonSerializer.Deserialize<List<FieldMatchSuggestion>>(text, CaseInsensitive) ?? [];

        var targetFieldNames = targetFields.Select(f => f.Name).ToList();
        var targetLengths = targetFields
            .Where(f => f.Length.HasValue)
            .ToDictionary(f => f.Name, f => f.Length!.Value);

        // Modelin istekte hic olmayan bir alan adi "uydurma" ihtimaline karsi
        // (LLM halisünasyonu) - sadece gercekten gonderdigimiz listelerde olan
        // alanlari, ve sadece bildigimiz sekilleri (direkt 1:1, gercek arity'sine
        // uyan Concat, ya da Length'i tanimli bir hedefe uyan LPad/RPad) kabul
        // ediyoruz. Not: model prompt'taki "(11)" gibi uzunluk ekini yanlislikla
        // targetField'a karistirsa bile, targetFieldNames.Contains() (tam
        // string eslesmesi) bunu zaten eler - ayri bir koruma gerekmiyor.
        var accepted = raw
            .Where(s =>
                s.SourceFields.Count > 0 &&
                s.SourceFields.All(sourceFieldNames.Contains) &&
                targetFieldNames.Contains(s.TargetField) &&
                IsSupportedShape(s, targetLengths))
            .ToList();

        // Length AI'den asla gelmiyor/guvenilmiyor - kabul edilen her LPad/RPad
        // onerisine, hedefin kendi Length'ini burada biz yaziyoruz. PadChar da
        // AI'den geliyor ama tek karakter degilse/bossa guvenli bir varsayilana
        // (sayisal ID'ler icin tipik "0") normalize ediliyor.
        foreach (var s in accepted.Where(s => s.FunctoidCode is "LPad" or "RPad"))
        {
            s.Length = targetLengths[s.TargetField];
            s.PadChar = string.IsNullOrEmpty(s.PadChar) || s.PadChar.Length > 1 ? DefaultPadChar : s.PadChar;
        }

        return accepted;
    }

    private bool IsSupportedShape(FieldMatchSuggestion s, Dictionary<string, int> targetLengths)
    {
        if (string.IsNullOrEmpty(s.FunctoidCode))
        {
            return s.SourceFields.Count == 1;
        }

        if (!AllowedFunctoidCodes.Contains(s.FunctoidCode))
        {
            return false;
        }

        var arity = functoidRegistry.Get(s.FunctoidCode).InputPorts.Count;
        if (s.SourceFields.Count != arity)
        {
            return false;
        }

        // LPad/RPad sadece gercekten sabit uzunluklu bir hedefe karsi anlamli -
        // Length tanimli degilse doldurmanin bir anlami yok.
        return s.FunctoidCode is not ("LPad" or "RPad") || targetLengths.ContainsKey(s.TargetField);
    }
}
