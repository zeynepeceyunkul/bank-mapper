using BankMapper.Application.FileTypes;
using BankMapper.Application.Products;
using BankMapper.Application.SourceSchemas;
using Microsoft.Extensions.DependencyInjection;

namespace BankMapper.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IFileTypeService, FileTypeService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ISourceSchemaService, SourceSchemaService>();

        return services;
    }
}
