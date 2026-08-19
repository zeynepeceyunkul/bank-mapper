using BankMapper.Application.Abstractions;
using BankMapper.Application.FieldMatching;
using BankMapper.Application.FileParsing;
using BankMapper.Application.FileWriting;
using BankMapper.Infrastructure.Auth;
using BankMapper.Infrastructure.Email;
using BankMapper.Infrastructure.FieldMatching;
using BankMapper.Infrastructure.FileParsing;
using BankMapper.Infrastructure.FileWriting;
using BankMapper.Infrastructure.Persistence;
using BankMapper.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http;

namespace BankMapper.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MongoDbSettings>(configuration.GetSection(MongoDbSettings.SectionName));
        services.AddSingleton<IMongoDbContext, MongoDbContext>();
        services.AddScoped<IFileTypeRepository, FileTypeRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ISourceSchemaRepository, SourceSchemaRepository>();
        services.AddScoped<IMappingRepository, MappingRepository>();
        services.AddScoped<IMappingRunRepository, MappingRunRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddSingleton<IFileParserFactory, FileParserFactory>();
        services.AddSingleton<IFileWriterFactory, FileWriterFactory>();

        services.Configure<EmailSettings>(configuration.GetSection(EmailSettings.SectionName));
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        services.Configure<GeminiSettings>(configuration.GetSection(GeminiSettings.SectionName));
        // HttpClient'in varsayilan Timeout'u 100 saniye - Gemini yavas/yanitsiz
        // kaldiginda kullanici bu kadar sure "Oneriler aliniyor..." ekraninda
        // bekleyip belirsiz bir hata aliyordu. Daha kisa bir sinir koyup hatayi
        // hizlica yuzeye cikariyoruz.
        services.AddHttpClient<IFieldMatchSuggestionService, GeminiFieldMatchSuggestionService>()
            .ConfigureHttpClient(client => client.Timeout = TimeSpan.FromSeconds(20));

        return services;
    }
}
