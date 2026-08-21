using System.Net;
using System.Text;
using BankMapper.Application.FieldMatching;
using BankMapper.Domain.Functoids;
using BankMapper.Infrastructure.FieldMatching;
using Microsoft.Extensions.Options;
using Xunit;

namespace BankMapper.Tests.FieldMatching;

public class GeminiFieldMatchSuggestionServiceTests
{
    private static GeminiFieldMatchSuggestionService CreateService(FakeHttpMessageHandler handler) =>
        new(
            new HttpClient(handler),
            Options.Create(new GeminiSettings { ApiKey = "test-key", Model = "gemini-2.5-flash" }),
            new FunctoidRegistry([new ConcatFunctoid(), new LPadFunctoid(), new RPadFunctoid(), new TrimFunctoid()]));

    // Uzunluk umursamayan eski testler icin kisa yol - Length gerektiren
    // LPad/RPad testleri kendi TargetFieldInfo'sunu acikca kuruyor.
    private static List<TargetFieldInfo> Targets(params string[] names) =>
        names.Select(n => new TargetFieldInfo(n, null)).ToList();

    // Gercek Gemini generateContent cevabinin gercek sekli - ic ice bir JSON
    // string'i tasiyor (candidates[0].content.parts[0].text).
    private static string WrapGeminiResponse(string innerJsonArray) =>
        $$"""
        {
          "candidates": [
            { "content": { "parts": [ { "text": {{System.Text.Json.JsonSerializer.Serialize(innerJsonArray)}} } ] } }
          ]
        }
        """;

    [Fact]
    public async Task Parses_valid_suggestions_from_a_real_shaped_gemini_response()
    {
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo"},{"sourceFields":["IBAN"],"targetField":"IBAN"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Ad", "TC", "IBAN"], Targets("AdSoyad", "TCKimlikNo", "IBAN"));

        Assert.Equal(2, result.Count);
        Assert.Contains(result, s => s.SourceFields.SequenceEqual(["TC"]) && s.TargetField == "TCKimlikNo");
        Assert.Contains(result, s => s.SourceFields.SequenceEqual(["IBAN"]) && s.TargetField == "IBAN");
    }

    [Fact]
    public async Task Filters_out_a_suggestion_that_references_a_field_not_in_the_original_lists()
    {
        // Model "halisünasyon" yapip istekte hic olmayan bir alan adi uydurabilir -
        // bu durumda o oneriyi filtrelememiz lazim.
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo"},{"sourceFields":["UydurulmusAlan"],"targetField":"IBAN"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Ad", "TC", "IBAN"], Targets("AdSoyad", "TCKimlikNo", "IBAN"));

        Assert.Single(result);
        Assert.Equal("TC", result[0].SourceFields[0]);
    }

    [Fact]
    public async Task Parses_a_concat_suggestion_combining_two_source_fields()
    {
        var innerJson = """[{"sourceFields":["Ad","Soyad"],"targetField":"AdSoyad","functoidCode":"Concat"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Ad", "Soyad", "IBAN"], Targets("AdSoyad", "IBAN"));

        Assert.Single(result);
        Assert.Equal(["Ad", "Soyad"], result[0].SourceFields);
        Assert.Equal("AdSoyad", result[0].TargetField);
        Assert.Equal("Concat", result[0].FunctoidCode);
    }

    [Fact]
    public async Task Filters_out_a_suggestion_with_a_functoid_code_outside_the_allowed_set()
    {
        // Kapsam karari geregi sadece Concat/LPad/RPad destekleniyor - model baska
        // bir functoid kodu "onerirse" (orn. veri kalitesi karari gerektiren
        // Upper - bilincli olarak disarida), bu oneri atlanmali.
        var innerJson = """[{"sourceFields":["Ad"],"targetField":"AdSoyad","functoidCode":"Upper"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Ad"], Targets("AdSoyad"));

        Assert.Empty(result);
    }

    [Fact]
    public async Task Filters_out_a_concat_suggestion_with_the_wrong_arity()
    {
        // Concat'in gercek arity'si (ConcatFunctoid.InputPorts) 2 - 3 alanli bir
        // "birlestirme" onerisi Concat'in gercekten yapabildigiyle uyusmuyor.
        var innerJson = """[{"sourceFields":["Ad","Soyad","Unvan"],"targetField":"AdSoyad","functoidCode":"Concat"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Ad", "Soyad", "Unvan"], Targets("AdSoyad"));

        Assert.Empty(result);
    }

    [Fact]
    public async Task Parses_an_lpad_suggestion_and_fills_in_length_from_the_target_field_not_the_model()
    {
        // Model bir uzunluk DONDURMEMELI (prompt boyle istiyor), ama dondurse bile
        // biz onu hic okumuyoruz - Length daima TargetField.Length'ten geliyor.
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo","functoidCode":"LPad","padChar":"0"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], [new TargetFieldInfo("TCKimlikNo", 11)]);

        Assert.Single(result);
        Assert.Equal("LPad", result[0].FunctoidCode);
        Assert.Equal(11, result[0].Length);
        Assert.Equal("0", result[0].PadChar);
    }

    [Fact]
    public async Task Parses_an_rpad_suggestion_the_same_way_as_lpad()
    {
        var innerJson = """[{"sourceFields":["Kod"],"targetField":"HesapKodu","functoidCode":"RPad","padChar":"X"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Kod"], [new TargetFieldInfo("HesapKodu", 8)]);

        Assert.Single(result);
        Assert.Equal("RPad", result[0].FunctoidCode);
        Assert.Equal(8, result[0].Length);
        Assert.Equal("X", result[0].PadChar);
    }

    [Fact]
    public async Task Missing_or_multi_character_pad_char_defaults_to_zero()
    {
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo","functoidCode":"LPad"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], [new TargetFieldInfo("TCKimlikNo", 11)]);

        Assert.Single(result);
        Assert.Equal("0", result[0].PadChar);
    }

    [Fact]
    public async Task Filters_out_an_lpad_suggestion_with_the_wrong_arity()
    {
        // LPad/RPad'in gercek arity'si (InputPorts) 1 - iki kaynak alanli bir
        // "doldurma" onerisi gecerli degil.
        var innerJson = """[{"sourceFields":["TC","Ek"],"targetField":"TCKimlikNo","functoidCode":"LPad"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["TC", "Ek"], [new TargetFieldInfo("TCKimlikNo", 11)]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Filters_out_an_lpad_suggestion_for_a_target_field_with_no_declared_length()
    {
        // Length tanimli degilse doldurmanin bir anlami yok - bu oneri reddedilmeli.
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo","functoidCode":"LPad"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], [new TargetFieldInfo("TCKimlikNo", null)]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Model_echoing_the_length_hint_into_target_field_is_filtered_by_the_existing_hallucination_guard()
    {
        // Prompt'ta hedefler "TCKimlikNo (11)" gibi gosteriliyor - model bunu
        // yanlislikla targetField'a aynen yazarsa, tam string eslesmesi zaten
        // bunu eliyor, ayri bir koruma gerekmiyor.
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo (11)","functoidCode":"LPad"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], [new TargetFieldInfo("TCKimlikNo", 11)]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Empty_field_lists_return_empty_without_calling_the_api()
    {
        var handler = new FakeHttpMessageHandler(_ => throw new InvalidOperationException("HTTP cagrisi yapilmamali idi"));

        var result = await CreateService(handler).SuggestAsync([], Targets("AdSoyad"));

        Assert.Empty(result);
    }

    [Fact]
    public async Task Non_success_http_status_throws()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateService(handler).SuggestAsync(["Ad"], Targets("AdSoyad")));
    }

    [Fact]
    public async Task Does_not_retry_a_non_transient_4xx_status()
    {
        // 401 gibi gercek istek hatalarinda tekrar denemek sonucu degistirmez -
        // tek seferde firlatilmali, ikinci bir cagri yapilmamali.
        var callCount = 0;
        var handler = new FakeHttpMessageHandler(_ =>
        {
            callCount++;
            return new HttpResponseMessage(HttpStatusCode.Unauthorized);
        });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateService(handler).SuggestAsync(["Ad"], Targets("AdSoyad")));

        Assert.Equal(1, callCount);
    }

    [Fact]
    public async Task Retries_once_after_a_transient_5xx_and_succeeds_on_second_attempt()
    {
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo"}]""";
        var callCount = 0;
        var handler = new FakeHttpMessageHandler(_ =>
        {
            callCount++;
            return callCount == 1
                ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
                : new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
                };
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], Targets("TCKimlikNo"));

        Assert.Equal(2, callCount);
        Assert.Single(result);
    }

    [Fact]
    public async Task Retries_once_after_a_timeout_and_succeeds_on_second_attempt()
    {
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo"}]""";
        var callCount = 0;
        var handler = new FakeHttpMessageHandler(_ =>
        {
            callCount++;
            if (callCount == 1)
            {
                throw new TaskCanceledException("Zaman asimi (simule edildi)");
            }
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
            };
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], Targets("TCKimlikNo"));

        Assert.Equal(2, callCount);
        Assert.Single(result);
    }

    [Fact]
    public async Task Retries_twice_after_transient_5xx_and_succeeds_on_third_attempt()
    {
        // Ece'nin 2026-08-21'de canli yasadigi vakanin testi: Gemini'nin
        // "high demand" 503'u art arda 2 denemede de gecmeyebiliyor, ucuncu
        // denemede gecmesi hala kurtarilabilir olmali.
        var innerJson = """[{"sourceFields":["TC"],"targetField":"TCKimlikNo"}]""";
        var callCount = 0;
        var handler = new FakeHttpMessageHandler(_ =>
        {
            callCount++;
            return callCount < 3
                ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
                : new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
                };
        });

        var result = await CreateService(handler).SuggestAsync(["TC"], Targets("TCKimlikNo"));

        Assert.Equal(3, callCount);
        Assert.Single(result);
    }

    [Fact]
    public async Task Gives_up_after_repeated_transient_failures()
    {
        var callCount = 0;
        var handler = new FakeHttpMessageHandler(_ =>
        {
            callCount++;
            return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
        });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateService(handler).SuggestAsync(["Ad"], Targets("AdSoyad")));

        Assert.Equal(3, callCount);
    }

    private class FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(respond(request));
    }
}
