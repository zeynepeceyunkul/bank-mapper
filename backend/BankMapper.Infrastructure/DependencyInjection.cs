using BankMapper.Application.Abstractions;
using BankMapper.Application.FieldMatching;
using BankMapper.Application.FileParsing;
using BankMapper.Application.FileWriting;
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
        services.AddSingleton<IFileParserFactory, FileParserFactory>();
        services.AddSingleton<IFileWriterFactory, FileWriterFactory>();

        services.Configure<GeminiSettings>(configuration.GetSection(GeminiSettings.SectionName));
        services.AddHttpClient<IFieldMatchSuggestionService, GeminiFieldMatchSuggestionService>();

        return services;
    }
}
