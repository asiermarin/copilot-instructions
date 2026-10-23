# Feature Templates

Replace `<Root>` with the solution prefix and `Asset` with the aggregate. Framework types (`NotFoundException`, `BadRequestException`, `ForbiddenException`, `ITenantContext`) come from the company framework (`<Company>.Framework.Common.*`). Use the equivalents in the solution if they differ.

## Contracts

```csharp
namespace <Root>.Application.Contracts.Entities.Requests;

using System.ComponentModel.DataAnnotations;

public sealed record CreateAssetRequest
{
    [Required, MaxLength(255)]
    public required string Name { get; init; }

    [MaxLength(1000)]
    public string? Description { get; init; }

    public required Guid PlantGuid { get; init; }
}
```

```csharp
namespace <Root>.Application.Contracts.Entities.Responses;

public sealed record AssetResponse
{
    public required Guid Guid { get; init; }

    public required string Name { get; init; }

    public string? Description { get; init; }

    public bool IsActive { get; init; }
}
```

## Entity and EF Configuration

```csharp
namespace <Root>.Persistence.Entities.Entities;

public partial class Asset
{
    public long AssetId { get; set; }

    public Guid AssetGuid { get; set; }

    public long TenantId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public virtual Tenant Tenant { get; set; } = null!;
}
```

```csharp
namespace <Root>.Persistence.Configurations;

using <Root>.Persistence.Entities.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

internal sealed class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> builder)
    {
        builder.HasKey(a => a.AssetId).HasName("PK_Assets_AssetId");
        builder.HasIndex(a => a.AssetGuid, "UQ_Assets_AssetGuid").IsUnique();
        builder.Property(a => a.Name).HasMaxLength(255);
        builder.Property(a => a.Description).HasMaxLength(1000);
        builder.HasOne(a => a.Tenant).WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}
```

Apply configurations in `OnModelCreating` with `modelBuilder.ApplyConfigurationsFromAssembly(typeof(ServiceContext).Assembly);`, or keep inline configuration if the solution already does.

## Ports (Persistence.Abstractions)

```csharp
namespace <Root>.Persistence.Abstractions.ReadRepositories;

using <Root>.Persistence.Entities.Entities;

public interface IAssetReadRepository
{
    IQueryable<Asset> GetAssetByGuidAsQueryable(Guid tenantGuid, Guid assetGuid);

    IQueryable<Asset> GetAssetsByTenantAsQueryable(Guid tenantGuid);
}
```

```csharp
namespace <Root>.Persistence.Abstractions.Repositories;

using <Root>.Persistence.Abstractions.ReadRepositories;
using <Root>.Persistence.Entities.Entities;

public interface IAssetRepository : IAssetReadRepository, IBaseRepository<Asset>
{
    Task<Asset> GetTrackedAssetByGuidAsync(Guid tenantGuid, Guid assetGuid, CancellationToken cancellationToken = default);
}
```

Add `IAssetReadRepository AssetReadRepository { get; }` to `IProjectionUnit` and `IAssetRepository AssetRepository { get; }` to `ITransactionUnit`.

## Persistence Adapters

```csharp
namespace <Root>.Persistence.Projections.ReadRepositories;

using <Root>.Persistence.Abstractions.ReadRepositories;
using <Root>.Persistence.Contexts;
using <Root>.Persistence.Entities.Entities;
using Microsoft.EntityFrameworkCore;

public sealed class AssetReadRepository(ServiceContext context) : IAssetReadRepository
{
    public IQueryable<Asset> GetAssetByGuidAsQueryable(Guid tenantGuid, Guid assetGuid) =>
        GetAssetsByTenantAsQueryable(tenantGuid)
            .Where(a => a.AssetGuid == assetGuid);

    public IQueryable<Asset> GetAssetsByTenantAsQueryable(Guid tenantGuid) =>
        context.Assets
            .AsNoTracking()
            .Where(a => a.Tenant.TenantGuid == tenantGuid);
}
```

Read ports return `IQueryable<T>` when the service projects with an `Application/Mappers` expression (persistence can't reference `Application`). Return a materialized entity or Response (throwing `NotFoundException`) when the query is self-contained, as in `TenantReadRepository.GetTenantStateAsync`.

```csharp
namespace <Root>.Persistence.Transactions.Repositories;

using <Root>.Persistence.Abstractions.Repositories;
using <Root>.Persistence.Contexts;
using <Root>.Persistence.Entities.Entities;
using Microsoft.EntityFrameworkCore;

public sealed class AssetRepository(ServiceContext context) : BaseRepository<Asset>(context), IAssetRepository
{
    public async Task<Asset> GetTrackedAssetByGuidAsync(Guid tenantGuid, Guid assetGuid, CancellationToken cancellationToken = default)
    {
        return await Context.Assets
            .SingleOrDefaultAsync(a => a.Tenant.TenantGuid == tenantGuid && a.AssetGuid == assetGuid, cancellationToken)
            ?? throw new NotFoundException($"Asset with Guid: {assetGuid} does not exist.");
    }

    public IQueryable<Asset> GetAssetByGuidAsQueryable(Guid tenantGuid, Guid assetGuid) =>
        GetAssetsByTenantAsQueryable(tenantGuid)
            .Where(a => a.AssetGuid == assetGuid);

    public IQueryable<Asset> GetAssetsByTenantAsQueryable(Guid tenantGuid) =>
        Context.Assets
            .Where(a => a.Tenant.TenantGuid == tenantGuid);
}
```

Units: `public IAssetRepository AssetRepository => _assetRepository ??= new AssetRepository(context);` (and the read equivalent in `ProjectionUnit`).

## Mapper

```csharp
namespace <Root>.Application.Mappers;

using System.Linq.Expressions;
using <Root>.Application.Contracts.Entities.Requests;
using <Root>.Application.Contracts.Entities.Responses;
using <Root>.Persistence.Entities.Entities;

public static class AssetMappers
{
    public static readonly Expression<Func<Asset, AssetResponse>> ToAssetResponseExpr = asset => new AssetResponse
    {
        Guid = asset.AssetGuid,
        Name = asset.Name,
        Description = asset.Description,
        IsActive = asset.IsActive
    };

    private static readonly Func<Asset, AssetResponse> ToAssetResponseFunc = ToAssetResponseExpr.Compile();

    public static AssetResponse ToAssetResponse(this Asset asset) => ToAssetResponseFunc(asset);

    public static Asset ToAsset(this CreateAssetRequest request, long tenantId) => new()
    {
        AssetGuid = Guid.NewGuid(),
        TenantId = tenantId,
        Name = request.Name,
        Description = request.Description,
        IsActive = true
    };
}
```

## Driving Port

```csharp
namespace <Root>.Application.Abstractions.Services;

using <Root>.Application.Contracts.Entities.Requests;
using <Root>.Application.Contracts.Entities.Responses;

public interface IAssetService
{
    /// <summary>Gets an asset of the current tenant.</summary>
    Task<AssetResponse> GetAssetAsync(Guid assetGuid, CancellationToken cancellationToken = default);

    /// <summary>Creates an asset for the current tenant and broadcasts the change.</summary>
    Task<Guid> CreateAssetAsync(CreateAssetRequest request, CancellationToken cancellationToken = default);
}
```

## Application Service

```csharp
namespace <Root>.Application.Services;

using <Root>.Application.Abstractions.Services;
using <Root>.Application.Contracts.Entities.Requests;
using <Root>.Application.Contracts.Entities.Responses;
using <Root>.Application.Mappers;
using <Root>.Persistence.Abstractions.Units;
using Microsoft.EntityFrameworkCore;

public sealed class AssetService(
    IProjectionUnit projectionUnit,
    ITransactionUnit transactionUnit,
    ITenantContext tenantContext,
    IBroadcastService broadcastService,
    ILogger<AssetService> logger) : IAssetService
{
    public async Task<AssetResponse> GetAssetAsync(Guid assetGuid, CancellationToken cancellationToken = default)
    {
        return await projectionUnit.AssetReadRepository
            .GetAssetByGuidAsQueryable(tenantContext.TenantId, assetGuid)
            .Select(AssetMappers.ToAssetResponseExpr)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException($"Asset with Guid: {assetGuid} does not exist.");
    }

    public async Task<Guid> CreateAssetAsync(CreateAssetRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var tenantId = await projectionUnit.TenantReadRepository.GetTenantIdByGuidAsync(tenantContext.TenantId, cancellationToken);
        var plantBelongsToTenant = await projectionUnit.PlantReadRepository.ExistsInTenantAsync(tenantId, request.PlantGuid, cancellationToken);

        if (!plantBelongsToTenant)
        {
            throw new ForbiddenException($"Plant {request.PlantGuid} does not belong to the current tenant.");
        }

        var asset = request.ToAsset(tenantId);

        await transactionUnit.AssetRepository.InsertAsync(asset, cancellationToken);
        await transactionUnit.CompleteWithExpectedAtLeastOneChangeAsync(cancellationToken);

        await broadcastService.BroadcastAssetMessageAsync(asset.ToAssetResponse(), MessageType.Add, cancellationToken);

        logger.LogInformation("Asset {AssetGuid} created for tenant {TenantGuid}", asset.AssetGuid, tenantContext.TenantId);

        return asset.AssetGuid;
    }
}
```

Registration: `services.AddScoped<IAssetService, AssetService>();` in `AddApplicationDependencies`. Add `BroadcastAssetMessageAsync` to the broadcast port and its adapter if the event is new.

## HTTP Adapter

```csharp
namespace <Root>.Controllers.Api;

using Asp.Versioning;
using <Root>.Application.Abstractions.Services;
using <Root>.Application.Contracts.Entities.Requests;
using <Root>.Application.Contracts.Entities.Responses;
using <Root>.Authorize;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[Authorize]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class AssetsController(IAssetService assetService) : ControllerBase
{
    [HttpGet("{assetGuid:guid}")]
    [Authorize(AuthorizePolicy.MySubscriptions)]
    [ProducesResponseType<AssetResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AssetResponse>> GetAssetAsync([FromRoute] Guid assetGuid, CancellationToken cancellationToken) =>
        Ok(await assetService.GetAssetAsync(assetGuid, cancellationToken));

    [HttpPost]
    [Authorize(AuthorizePolicy.MySubscriptions)]
    [ProducesResponseType<Guid>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Guid>> CreateAssetAsync([FromBody] CreateAssetRequest request, CancellationToken cancellationToken)
    {
        var assetGuid = await assetService.CreateAssetAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetAssetAsync), new { assetGuid, version = "1.0" }, assetGuid);
    }
}
```

`CreatedAtAction` with an `…Async` action name requires `options.SuppressAsyncSuffixInActionNames = false` in `AddControllers`, or naming the actions without the suffix. Follow the solution's existing choice.

## Message Adapter

```csharp
namespace <Root>.Application.Handlers;

using <Root>.Application.Abstractions.Services;

public sealed class AssetHandler(IAssetService assetService, ILogger<AssetHandler> logger) : BaseLicensingHandler<AssetMessage>
{
    protected override async Task HandleMessageAsync(Message<AssetMessage> message)
    {
        if (message.Payload is null)
        {
            logger.LogError("AssetMessage {MessageId} has no payload", message.Id);
            return;
        }

        if (message.Payload.Broadcaster == Broadcaster.Subscriptions)
        {
            return;
        }

        await (message.Type switch
        {
            MessageType.Update => assetService.SyncAssetAsync(message.Payload.ToSyncAssetRequest()),
            MessageType.Delete => assetService.DeleteAssetAsync(message.Payload.AssetGuid),
            _ => LogUnsupportedAsync(message.Type)
        });
    }

    private Task LogUnsupportedAsync(MessageType? type)
    {
        logger.LogWarning("Unsupported AssetMessage type {MessageType}", type);
        return Task.CompletedTask;
    }
}
```

## Desktop / Worker Adapter

```csharp
namespace <Root>.Desktop.Assets;

using <Root>.Application.Abstractions.Services;
using <Root>.Application.Contracts.Entities.Responses;
using Microsoft.Extensions.DependencyInjection;

public sealed class AssetDetailsPresenter(IServiceScopeFactory scopeFactory)
{
    public async Task<AssetResponse> LoadAsync(Guid assetGuid, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var assetService = scope.ServiceProvider.GetRequiredService<IAssetService>();

        return await assetService.GetAssetAsync(assetGuid, cancellationToken);
    }
}
```

## Migration

```powershell
dotnet ef migrations add AddAssets --context ServiceContext --project <Root>.Persistence --startup-project <Root>
dotnet ef migrations script --idempotent --context ServiceContext --project <Root>.Persistence --startup-project <Root>
```
