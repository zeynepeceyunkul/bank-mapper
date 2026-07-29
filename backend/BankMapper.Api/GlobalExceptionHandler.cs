using Microsoft.AspNetCore.Diagnostics;

namespace BankMapper.Api;

// ArgumentException hep gecersiz/eksik istek verisi icin kullaniliyor (bkz.
// MappingService/SourceSchemaService validasyonlari), bu yuzden 400 + mesaj
// olarak donuyor. FormatException de benzer sekilde 400'e cevriliyor: {id}
// route parametresi alan her endpoint (mappings/file-types/source-schemas)
// MongoDB'nin ObjectId donusumune ham route string'ini veriyor - 24 haneli
// hex olmayan bir deger (ornegin bir Postman placeholder'i yanlislikla
// degistirilmeden gonderilirse) MongoDB.Driver'in kendi FormatException'ini
// firlatiyor, bunu yakalamazsak genel 500'e dusuyordu. Baska her exception
// 500 + genel mesaj: detaylar client'a sizdirilmiyor, tam stack trace
// Serilog'a yaziliyor.
// Yanit govdesi kasitli olarak duz bir JSON string (ProblemDetails degil) -
// mevcut controller'larin `return BadRequest(ex.Message)` cagrilarinin ürettigi
// govdeyle ayni, frontend zaten `typeof err.error === 'string'` bekliyor.
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (statusCode, message) = exception switch
        {
            ArgumentException => (StatusCodes.Status400BadRequest, exception.Message),
            FormatException => (StatusCodes.Status400BadRequest, "Geçersiz id formatı."),
            _ => (StatusCodes.Status500InternalServerError, "Beklenmeyen bir hata olustu.")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Islenmeyen hata: {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            logger.LogWarning("Istek reddedildi ({StatusCode}) {Path}: {Message}", statusCode, httpContext.Request.Path, message);
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(message, cancellationToken);

        return true;
    }
}
