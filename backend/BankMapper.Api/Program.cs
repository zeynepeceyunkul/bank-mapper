using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BankMapper.Api;
using BankMapper.Application;
using BankMapper.Infrastructure;
using BankMapper.Infrastructure.Auth;
using BankMapper.Infrastructure.Persistence;
using BankMapper.Infrastructure.Persistence.Seed;
using BankMapper.Domain.Enums;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Formatting.Compact;

const string FrontendClient = "FrontendClient";

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
        policy.Requirements.Add(new FreshRoleRequirement(UserRole.SuperAdmin, UserRole.MappingDefiner)));

    options.AddPolicy("MappingApprove", policy =>
        policy.Requirements.Add(new FreshRoleRequirement(UserRole.SuperAdmin, UserRole.Approver)));

    // Eskiden sadece Admin - Ece'nin karari (2026-08-22): bir mapping'i
    // tanimlayan/onaylayan kisinin de gonderim/onay oncesi kendi cikisini
    // gorebilmesi/test edebilmesi mantikli, bu yuzden MappingManage/
    // MappingApprove'daki ayni rol seti (Admin+MappingDefiner+Approver)
    // buraya da acildi - Viewer haric (zaten canvas'i da goremiyor).
    options.AddPolicy("Convert", policy =>
        policy.Requirements.Add(new FreshRoleRequirement(UserRole.SuperAdmin, UserRole.MappingDefiner, UserRole.Approver)));

    options.AddPolicy("UserManage", policy =>
        policy.Requirements.Add(new FreshRoleRequirement(UserRole.SuperAdmin)));
});

// Guvenlik sikilastirma listesinden (2026-08-18 denetimi, Ece 2026-08-22'de
// onayladi) - IP basina sabit pencereli sinir. Once auth (login/register/
// e-posta islemleri - brute-force/spam-hesap riski) ve AI oneri (Gemini
// cagrisi - hem maliyetli hem de ucretsiz katmanin kendi kotasini paylasiyor)
// uclarina oncelik verildi, digerlerine simdilik dokunulmadi. QueueLimit: 0 -
// sinir asilinca istek kuyruga alinip bekletilmiyor, dogrudan 429 donuyor.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    options.AddPolicy("ai-suggestion", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks().AddCheck<MongoHealthCheck>("mongodb");

// İzinli origin'ler Cors:AllowedOrigins config değeriyle (env var:
// Cors__AllowedOrigins, virgülle ayrılmış) verilebilir - prod'da Firebase
// Hosting URL'i gibi. Verilmezse sadece dev sunucusuna (localhost:4200)
// izin verilir.
var corsAllowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:4200")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendClient, policy =>
        policy.WithOrigins(corsAllowedOrigins).AllowAnyHeader().AllowAnyMethod());
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

// Guvenlik sikilastirma listesinden (Ece 2026-08-22'de onayladi) - uygulama
// baska bir sisteme gomulu OLMAYACAK (Ece'nin kendi tespiti, 2026-08-21:
// kendi self-servis login/rol sistemi kurulmus olmasi bunun standalone
// calisacagini zaten gosteriyor), bu yuzden guvenle "asla bir iframe icinde
// gosterilme" denebiliyor - clickjacking'e karsi. Iki header birden: eski
// tarayicilar icin X-Frame-Options, modern tarayicilar icin CSP
// frame-ancestors (ikisi de ayni seyi soyluyor, biri digerinin yedegi).
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Content-Security-Policy", "frame-ancestors 'none'");
    await next();
});

app.UseCors(FrontendClient);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();
