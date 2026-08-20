using BankMapper.Application.Auth;
using BankMapper.Application.FileTypes;
using BankMapper.Application.Functoids;
using BankMapper.Application.Institutions;
using BankMapper.Application.Mappings;
using BankMapper.Application.Preview;
using BankMapper.Application.Products;
using BankMapper.Application.RunHistory;
using BankMapper.Application.SourceSchemas;
using BankMapper.Application.Users;
using BankMapper.Domain.Execution;
using BankMapper.Domain.Functoids;
using Microsoft.Extensions.DependencyInjection;

namespace BankMapper.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IFileTypeService, FileTypeService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ISourceSchemaService, SourceSchemaService>();
        services.AddScoped<IInstitutionService, InstitutionService>();
        services.AddScoped<IMappingService, MappingService>();
        services.AddScoped<IFunctoidService, FunctoidService>();
        services.AddScoped<IPreviewService, PreviewService>();
        services.AddScoped<IRunHistoryService, RunHistoryService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();

        services.AddSingleton<IFunctoid, TrimFunctoid>();
        services.AddSingleton<IFunctoid, LPadFunctoid>();
        services.AddSingleton<IFunctoid, RPadFunctoid>();
        services.AddSingleton<IFunctoid, ConcatFunctoid>();
        services.AddSingleton<IFunctoid, UpperFunctoid>();
        services.AddSingleton<IFunctoid, LowerFunctoid>();
        services.AddSingleton<FunctoidRegistry>();
        services.AddSingleton<MappingExecutor>();

        return services;
    }
}
