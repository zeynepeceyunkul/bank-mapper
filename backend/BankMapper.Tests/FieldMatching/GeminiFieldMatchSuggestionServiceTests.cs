using System.Net;
using System.Text;
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
            new FunctoidRegistry([new ConcatFunctoid()]));

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

        var result = await CreateService(handler).SuggestAsync(["Ad", "TC", "IBAN"], ["AdSoyad", "TCKimlikNo", "IBAN"]);

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

        var result = await CreateService(handler).SuggestAsync(["Ad", "TC", "IBAN"], ["AdSoyad", "TCKimlikNo", "IBAN"]);

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

        var result = await CreateService(handler).SuggestAsync(["Ad", "Soyad", "IBAN"], ["AdSoyad", "IBAN"]);

        Assert.Single(result);
        Assert.Equal(["Ad", "Soyad"], result[0].SourceFields);
        Assert.Equal("AdSoyad", result[0].TargetField);
        Assert.Equal("Concat", result[0].FunctoidCode);
    }

    [Fact]
    public async Task Filters_out_a_suggestion_with_a_functoid_code_outside_the_allowed_set()
    {
        // Kapsam karari geregi sadece Concat destekleniyor - model baska bir
        // functoid kodu "onerirse" (izin verilmeyen), bu oneri atlanmali.
        var innerJson = """[{"sourceFields":["Ad"],"targetField":"AdSoyad","functoidCode":"Upper"}]""";
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(WrapGeminiResponse(innerJson), Encoding.UTF8, "application/json"),
        });

        var result = await CreateService(handler).SuggestAsync(["Ad"], ["AdSoyad"]);

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

        var result = await CreateService(handler).SuggestAsync(["Ad", "Soyad", "Unvan"], ["AdSoyad"]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Empty_field_lists_return_empty_without_calling_the_api()
    {
        var handler = new FakeHttpMessageHandler(_ => throw new InvalidOperationException("HTTP cagrisi yapilmamali idi"));

        var result = await CreateService(handler).SuggestAsync([], ["AdSoyad"]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Non_success_http_status_throws()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateService(handler).SuggestAsync(["Ad"], ["AdSoyad"]));
    }

    private class FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(respond(request));
    }
}
