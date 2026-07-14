using BankMapper.Application.FileTypes;
using BankMapper.Application.Products;
using Microsoft.Extensions.DependencyInjection;

namespace BankMapper.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IFileTypeService, FileTypeService>();
        services.AddScoped<IProductService, ProductService>();

        return services;
    }
}
