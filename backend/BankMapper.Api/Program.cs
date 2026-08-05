using System.Text.Json.Serialization;
using BankMapper.Api;
using BankMapper.Application;
using BankMapper.Infrastructure;
using BankMapper.Infrastructure.Persistence;
using BankMapper.Infrastructure.Persistence.Seed;
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

app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
