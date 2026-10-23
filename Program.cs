using OzonTracker.Api.Services;
using OzonTracker.Api.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<SqlProfileRepository>();
builder.Services.AddScoped<SqlAccountRepository>();
builder.Services.AddScoped<CurrentAccount>();
builder.Services.AddScoped<SqlNotificationRepository>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IPasswordHasher<Account>, PasswordHasher<Account>>();
builder.Services.Configure<PasswordHasherOptions>(options => options.IterationCount = 600000);
builder.Services.AddDataProtection().SetApplicationName("OzonTracker.Api")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, ".local", "keys")));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "OzonTracker.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;
        return context.Response.WriteAsJsonAsync(new { message = "Войдите в аккаунт." });
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = 403;
        return context.Response.WriteAsJsonAsync(new { message = "Доступ закрыт." });
    };
});
builder.Services.AddAuthorization(options => options.FallbackPolicy =
    new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = (context, ct) => new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
        new { message = "Слишком много попыток. Повторите через минуту." }, ct));
});

builder.Services.AddScoped<
    IProductRepository,
    SqlProductRepository>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    var databaseError = error is Microsoft.Data.SqlClient.SqlException;
    context.Response.StatusCode = databaseError ? 503 : 500;
    await context.Response.WriteAsJsonAsync(new
    {
        message = databaseError
            ? "База данных недоступна. Проверьте SQL Server, выполните Database/setup.sql и настройте ConnectionStrings:OzonTracker."
            : "Не удалось выполнить операцию. Подробности в журнале сервера."
    });
}));

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.Run();

// Привет мир

