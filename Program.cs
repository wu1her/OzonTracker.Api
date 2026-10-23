using OzonTracker.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

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
            .AllowAnyMethod();
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

app.MapControllers();

app.Run();

// Привет мир

