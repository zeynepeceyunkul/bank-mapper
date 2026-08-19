using System.Text;
using System.Text.Json.Serialization;
using BankMapper.Api;
using BankMapper.Application;
using BankMapper.Infrastructure;
using BankMapper.Infrastructure.Auth;
using BankMapper.Infrastructure.Persistence;
using BankMapper.Infrastructure.Persistence.Seed;
using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Formatting.Compact;

const string AngularDevClient = "AngularDevClient";

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .WriteTo.Console()
    .WriteTo.File(new CompactJsonFormatter(), "logs/log-.json", rollingInterval: RollingInterval.Day));

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? new JwtSettings();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Varsayilan davranista JwtBearer bazi claim tiplerini (orn. "sub" ->
        // ClaimTypes.NameIdentifier) sessizce baska bir tipe yeniden esliyor -
        // bu, token uretilirken yazilan claim tipiyle (JwtRegisteredClaimNames.Sub)
        // okunurken aranan claim tipinin uyusmamasina yol acabilir. Bunu kapatip
        // token'a ne yazildiysa controller'da da ayni tipte okunmasini garanti
        // ediyoruz.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
        };
    });

builder.Services.AddScoped<IAuthorizationHandler, FreshRoleAuthorizationHandler>();

// Fallback policy: /api/auth altindakiler disinda HER endpoint varsayilan
// olarak gecerli bir token istiyor - controller controller [Authorize]
// eklemeyi unutma riskine girmek yerine "aksi belirtilmedikce herkes login
// olmali" varsayilanini tercih ediyoruz (AuthController zaten [AllowAnonymous]).
//
// Hassas/degistirici uclar (mapping/sema olustur-sil, donusturme) burada
// tanimlanan policy'lerle FreshRoleRequirement kullaniyor - JWT'nin icine
// login aninda damgalanmis role claim'ine degil, o an Mongo'daki gercek
// role'e bakiyor (bkz. FreshRoleAuthorizationHandler'daki yorum).
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy("MappingManage", policy =>
        policy.Requirements.Add(new FreshRoleRequirement(UserRole.Admin, UserRole.MappingDefiner)));

    options.AddPolicy("Convert", policy =>
        policy.Requirements.Add(new FreshRoleRequirement(UserRole.Admin)));
});

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks().AddCheck<MongoHealthCheck>("mongodb");

builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularDevClient, policy =>
        policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var mongoDbContext = scope.ServiceProvider.GetRequiredService<IMongoDbContext>();
    await DbSeeder.SeedAsync(mongoDbContext);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();

app.UseExceptionHandler();

app.UseHttpsRedirection();

app.UseCors(AngularDevClient);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();
