# Project Layout

`<Root>` = `<Company>.<Domain>.<Service>.<HostSuffix>`. Omit layers that would be empty (e.g. no `Application.External` without outbound integrations, no persistence projects with `none` database).

## Projects and References

| Project | Template | References |
|---|---|---|
| `<Root>` (host) | `webapi --use-controllers` / `worker` / `console` / UI template | Application, Application.External, Persistence, Persistence.Projections, Persistence.Transactions |
| `<Root>.Application.Contracts` | `classlib` | — |
| `<Root>.Application.Abstractions` | `classlib` | Application.Contracts |
| `<Root>.Application` | `classlib` | Application.Abstractions, Application.Contracts, Application.Utils, Persistence.Abstractions, Persistence.Entities |
| `<Root>.Application.External` | `classlib` | Application.Abstractions, Application.Contracts |
| `<Root>.Application.Utils` | `classlib` | Application.Contracts, Persistence.Abstractions |
| `<Root>.Persistence.Entities` | `classlib` | Utils |
| `<Root>.Persistence.Abstractions` | `classlib` | Persistence.Entities, Application.Contracts |
| `<Root>.Persistence` | `classlib` | Persistence.Abstractions, Persistence.Entities |
| `<Root>.Persistence.Projections` | `classlib` | Persistence, Persistence.Abstractions, Application.Utils |
| `<Root>.Persistence.Transactions` | `classlib` | Persistence, Persistence.Abstractions, Application.Utils |
| `<Root>.Utils` | `classlib` | — |
| `<Root>.Tests.Common` | `classlib` | Application.Contracts, Persistence.Abstractions, Persistence.Entities, Persistence |
| `<Root>.UnitTests` | `nunit` | Host, Application, Application.External, Tests.Common |
| `<Root>.IntegrationTests` | `nunit` | Host, Tests.Common |
| `<Root>.FeatureTests` | `nunit` | Application.Contracts, Tests.Common |

## Folder Skeleton

```text
<Root>/                              Controllers/Api, Authorize, Configurators, Middleware, Extensions, Settings, k8s/base, k8s/patches
<Root>.Application.Contracts/        Entities/Requests, Entities/Responses, Dtos, Enums, Validators, Common
<Root>.Application.Abstractions/     Services, Factories
<Root>.Application/                  Services, Mappers, Handlers, BackgroundServices, Configurators, Settings, Extensions
<Root>.Application.External/         Services, Factories, Configurators
<Root>.Persistence.Entities/         Entities, Enums
<Root>.Persistence.Abstractions/     ReadRepositories, Repositories, Units, Contexts
<Root>.Persistence/                  Contexts, Configurations, Migrations, Configurators
<Root>.Persistence.Projections/      ReadRepositories, Units, Configurators
<Root>.Persistence.Transactions/     Repositories, Units, Configurators
<Root>.Tests.Common/                 Builders, Data, Databases, Mocks, Models
<Root>.UnitTests/                    mirrors production folders + Utils
<Root>.IntegrationTests/             Fixtures, <Feature folders>
<Root>.FeatureTests/                 Controllers, Utils
```

## Skeleton Code

### Layer configurator

```csharp
namespace <Root>.Application.Configurators;

using <Root>.Application.Abstractions.Services;
using <Root>.Application.Services;
using Microsoft.Extensions.DependencyInjection;

public static class InversionOfControlConfigurator
{
    public static IServiceCollection AddApplicationDependencies(this IServiceCollection services)
    {
        services.AddScoped<ISampleService, SampleService>();

        return services;
    }
}
```

### Units of work (ports)

```csharp
namespace <Root>.Persistence.Abstractions.Units;

using <Root>.Persistence.Abstractions.ReadRepositories;

public interface IProjectionUnit
{
    ISampleReadRepository SampleReadRepository { get; }
}
```

```csharp
namespace <Root>.Persistence.Abstractions.Units;

using <Root>.Persistence.Abstractions.Repositories;
using Microsoft.EntityFrameworkCore.Storage;

public interface ITransactionUnit : IDisposable
{
    ISampleRepository SampleRepository { get; }

    Task<int> CompleteAsync(CancellationToken cancellationToken = default);

    Task<int> CompleteWithExpectedAtLeastOneChangeAsync(CancellationToken cancellationToken = default);

    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);

    Task<bool> CanConnectDatabaseAsync(CancellationToken cancellationToken = default);

    void ClearTracking();
}
```

### Base repository and transaction unit

`ServiceContext` stands for the solution's `<Service>Context` (`DbContext`). Every write repository is added to `TransactionUnit` as a lazily created property. `ProjectionUnit` follows the same pattern with read repositories.

```csharp
namespace <Root>.Persistence.Transactions.Repositories;

using <Root>.Persistence.Abstractions.Repositories;
using <Root>.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

public abstract class BaseRepository<T>(ServiceContext context) : IBaseRepository<T>
    where T : class
{
    protected ServiceContext Context { get; } = context;

    public async Task InsertAsync(T entity, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entity);

        await Context.Set<T>().AddAsync(entity, cancellationToken);
    }

    public void Delete(T entity)
    {
        ArgumentNullException.ThrowIfNull(entity);

        Context.Set<T>().Remove(entity);
    }
}
```

```csharp
namespace <Root>.Persistence.Transactions.Units;

using <Root>.Persistence.Abstractions.Repositories;
using <Root>.Persistence.Abstractions.Units;
using <Root>.Persistence.Contexts;
using <Root>.Persistence.Transactions.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

public sealed class TransactionUnit(ServiceContext context) : ITransactionUnit
{
    private ISampleRepository? _sampleRepository;

    public ISampleRepository SampleRepository => _sampleRepository ??= new SampleRepository(context);

    public Task<int> CompleteAsync(CancellationToken cancellationToken = default) =>
        context.SaveChangesAsync(cancellationToken);

    public async Task<int> CompleteWithExpectedAtLeastOneChangeAsync(CancellationToken cancellationToken = default)
    {
        var changes = await context.SaveChangesAsync(cancellationToken);

        return changes > 0
            ? changes
            : throw new InvalidOperationException("No changes were persisted.");
    }

    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) =>
        context.Database.BeginTransactionAsync(cancellationToken);

    public Task<bool> CanConnectDatabaseAsync(CancellationToken cancellationToken = default) =>
        context.Database.CanConnectAsync(cancellationToken);

    public void ClearTracking() => context.ChangeTracker.Clear();

    public void Dispose() => context.Dispose();
}
```

### Backend host (minimal hosting variant)

Top-level statements can't be combined with a namespace. `public partial class Program;` exposes the entry point to `WebApplicationFactory<Program>`.

```csharp
using System.Text.Json.Serialization;
using Asp.Versioning;
using <Root>.Configurators;
using <Root>.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
}).AddMvc();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddHealthChecks();
builder.Services.AddDependencies(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

public partial class Program;
```

When the company framework provides `StartupBase`, use `Program` + `Startup : StartupBase` instead, overriding `AddAuthorization`, `AddServices`, `AddHostedServices` and `UseCors`. In that case the framework already maps its exceptions.

### Exception → ProblemDetails handler (backend)

```csharp
namespace <Root>.Middleware;

using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

public sealed class ProblemDetailsExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ProblemDetailsExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            BadRequestException => (StatusCodes.Status400BadRequest, "Bad request"),
            ForbiddenException => (StatusCodes.Status403Forbidden, "Forbidden"),
            NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected error")
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception processing {Path}", httpContext.Request.Path);
        }

        httpContext.Response.StatusCode = status;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = status == StatusCodes.Status500InternalServerError ? null : exception.Message
            }
        });
    }
}
```

### Desktop / worker host

```csharp
namespace <Root>;

using <Root>.Configurators;

public static class Program
{
    public static async Task Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);

        builder.Services.AddDependencies(builder.Configuration);

        using var host = builder.Build();

        await host.RunAsync();
    }
}
```

For a desktop UI, build the host before showing the main window, resolve the main window/view-model from `host.Services`, and call `host.StartAsync()` / `StopAsync()` around the UI lifetime.

### Dockerfile (backend)

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
ARG sources="./obj/Release/publish"
RUN addgroup -g 10001 -S appgroup && adduser -u 10001 -S appuser -G appgroup
WORKDIR /app
COPY $sources .
USER 10001
ENTRYPOINT ["dotnet", "<Root>.dll"]
```
