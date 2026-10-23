---
description: 'Clean/hexagonal architecture standard for .NET solutions (microservices, desktop and worker apps): project layout, layer responsibilities, dependency rule, ports and adapters, CQRS-lite persistence, mappers and composition root.'
applyTo: '**/*.cs, **/*.csproj, **/*.sln, **/*.slnx, **/Directory.Build.props, **/Directory.Packages.props'
---

# .NET Clean / Hexagonal Architecture

Reference implementation: `Lantek360.Licensing.Subscriptions.Backend`. The same layers are used for microservices (ASP.NET Core host), desktop applications and workers (Generic Host). Only the host project changes.

## Core Rules

- The application core (use cases) depends only on **ports** (interfaces). **Adapters** implement driven ports (database, HTTP, messaging) or call driving ports (controllers, message handlers, UI).
- Dependencies point inward. The core never references hosting, UI, EF Core providers/DbContext, HTTP clients or messaging SDKs.
- The **host is the only composition root**: it is the only project that references every implementation and wires adapters to ports.
- Persistence is **CQRS-lite**: reads go through `IProjectionUnit` (no tracking, projections), writes go through `ITransactionUnit` (tracking, `CompleteAsync`).
- Each layer exposes exactly one DI entry point: `Configurators/InversionOfControlConfigurator.cs` with `Add<Layer>Dependencies(this IServiceCollection services)`.
- Don't create empty or speculative projects. Add a layer when it has content.

## Project Naming

`<Company>.<Domain>.<Service>.<Layer>`, for example `Lantek360.Licensing.Subscriptions.Backend.Application.Abstractions`.

- Host suffix: `.Backend` (web API microservice), `.Desktop` (desktop app), `.Worker` (headless service/daemon).
- Root namespace = project name; sub-namespaces = folders.

## Layers

| Layer | Project suffix | Responsibility | Folders |
|---|---|---|---|
| Host (driving adapter + composition root) | `.Backend` / `.Desktop` / `.Worker` | Entry point, transport (HTTP/UI), auth, middleware, root DI | `Controllers/Api`, `Authorize`, `Middleware`, `Configurators`, `Extensions`, `Settings`, `Loaders` |
| Contracts | `.Application.Contracts` | Data crossing the core boundary | `Entities/Requests`, `Entities/Responses`, `Dtos`, `Enums`, `Validators`, `Common` |
| Driving ports | `.Application.Abstractions` | Use-case interfaces and outbound service ports | `Services` (`I*Service`), `Factories` (`I*Factory`), `Extensions` |
| Application core | `.Application` | Use-case implementations | `Services`, `Mappers`, `Handlers`, `BackgroundServices`, `Configurators`, `Settings`, `Extensions`, `Utils` |
| Outbound adapters | `.Application.External` | Third-party HTTP APIs, event broadcast, in-process queues | `Services`, `Factories` |
| Application utils | `.Application.Utils` | Helpers shared by core and persistence adapters | by topic |
| Entities | `.Persistence.Entities` | EF Core entity classes and persistence enums | `Entities`, `Enums` |
| Driven ports | `.Persistence.Abstractions` | Repository and unit-of-work interfaces | `ReadRepositories`, `Repositories`, `Units`, `Contexts` |
| Persistence core | `.Persistence` | `DbContext`(s), entity configuration, migrations, design-time factory | `Contexts`, `Configurations`, `Migrations`, `Configurators` |
| Read adapter | `.Persistence.Projections` | `*ReadRepository`, `ProjectionUnit` | `ReadRepositories`, `Units`, `Configurators` |
| Write adapter | `.Persistence.Transactions` | `BaseRepository<T>`, `*Repository`, `TransactionUnit` | `Repositories`, `Units`, `Configurators` |
| Cross-cutting | `.Utils` | Domain-agnostic providers and extensions | `Providers`, `Extensions` |
| Tests | `.UnitTests`, `.IntegrationTests`, `.FeatureTests`, `.Tests.Common` | See `dotnet-testing` instructions | mirror production folders |

## Dependency Rule (allowed project references)

- `.Utils` → nothing
- `.Persistence.Entities` → `.Utils`
- `.Application.Contracts` → shared framework packages only. **Never** `.Persistence.Entities`; mirror needed enums in `Contracts/Enums` and convert in mappers.
- `.Application.Abstractions` → Contracts
- `.Persistence.Abstractions` → Entities, Contracts (read ports may return projected Responses)
- `.Application.Utils` → Contracts, Persistence.Abstractions
- `.Application` → Application.Abstractions, Contracts, Persistence.Abstractions, Persistence.Entities, Application.Utils. **Never** External, Persistence, Projections or Transactions.
- `.Application.External` → Application.Abstractions, Contracts
- `.Persistence` → Persistence.Abstractions, Entities
- `.Persistence.Projections` / `.Persistence.Transactions` → Persistence, Persistence.Abstractions, Entities, Application.Utils
- Host → Application, Application.External, Persistence, Persistence.Projections, Persistence.Transactions
- Tests may reference what they test plus `.Tests.Common`.

Accepted trade-off: Application and Persistence.Abstractions may reference `Microsoft.EntityFrameworkCore` (async LINQ over `IQueryable` returned by read ports, `IDbContextTransaction`), but never a provider package (`SqlServer`, `Sqlite`) or a concrete `DbContext`.

When an existing solution breaks this rule (for example Application → Projections/Transactions), don't add new violations. Register implementations from the host instead.

## Ports

- Use-case port: `I<Aggregate>Service` in `Application.Abstractions/Services`, async methods returning Contracts types, last parameter `CancellationToken cancellationToken = default`.
- Outbound port: interface named after the capability, not the vendor transport (`IBroadcastService`, `IImageStorageService`). Vendor-specific adapters may keep the vendor name (`IAtlassianService`) when the port is genuinely vendor-specific.
- Read port: `I<Entity>ReadRepository` in `Persistence.Abstractions/ReadRepositories`. Returns entities, projected Responses or `IQueryable<T>` for composition (`Get…AsQueryable`).
- Write port: `I<Entity>Repository : I<Entity>ReadRepository, IBaseRepository<TEntity>` in `Persistence.Abstractions/Repositories`.
- Units: `IProjectionUnit` exposes every read repository. `ITransactionUnit : IDisposable` exposes every write repository plus `CompleteAsync`, `CompleteWithExpectedAtLeastOneChangeAsync`, `CompleteWithExpectedChangesAsync`, `BeginTransactionAsync`, `ClearTracking`, `CanConnectDatabaseAsync`.

## Persistence

- One `DbContext` per database. Entity configuration via Fluent API (`OnModelCreating` or `IEntityTypeConfiguration<T>`), with explicit key names, unique indexes and max lengths.
- Entities: public (non-sealed for lazy-loading proxies) `partial` classes with `virtual` navigations, collections initialized to `[]`, a `long` internal key plus a public `Guid` (`TenantId` + `TenantGuid`). Never expose internal ids outside the core.
- Read repositories: `AsNoTracking()`, project with `Select(<Entity>Mappers.To<X>Expr)` so SQL only fetches needed columns, and throw `NotFoundException` on missing single results.
- Write repositories: tracked queries, inherit `BaseRepository<T>`, and never call `SaveChanges`. The service calls `transactionUnit.CompleteAsync(cancellationToken)` once per use case.
- Multi-step writes that must be atomic use `await using var transaction = await transactionUnit.BeginTransactionAsync(cancellationToken);` then `CommitAsync`.
- Units are scoped and lazily create their repositories. A `DbContext` is never shared across threads. Background work creates its own scope.
- Migrations live in `.Persistence/Migrations`, are created with `dotnet ef migrations add <Name> --context <Context> --project <Persistence> --startup-project <Host>`, and are never edited after merge.

## Mappers

- No AutoMapper/Mapster. Use `public static class <Entity>Mappers` in `Application/Mappers`.
- Provide `public static readonly Expression<Func<TEntity, TResponse>> To<Response>Expr` for EF projection, and extension methods `To<Response>(this TEntity entity)` / `To<Entity>(this TRequest request)` for in-memory mapping.
- Mappers are pure: no I/O, no DI, no logging.

## Application Services

- One service per aggregate/use-case group (`TenantService`, `TenantProductService`). Split when a service exceeds ~500 lines or mixes unrelated responsibilities.
- Shape of a use case: validate input → load via projection/transaction unit → apply business rules (private static helpers) → persist via `CompleteAsync` → broadcast domain events via outbound port → map to Response.
- Tenant scoping comes from the injected tenant context (`ITenantContext`). Never trust tenant identifiers from the payload without checking them against the context.
- Long-running or unreliable outbound calls are enqueued (`I<X>Queue`) and processed by a `BackgroundService` worker that creates a scope per item.

## Messaging

- Inbound messages: `<Topic>Handler` classes in `Application/Handlers` inheriting the framework base handler (`BaseLicensingHandler<T>`). Each handler delegates to an application service and contains no business logic.
- Ignore messages the service broadcast itself (check the `Broadcaster` field) to avoid loops.
- Outbound events go through an `IBroadcastService`-style port. Producers are singletons created by a factory.

## Composition Root

- Each layer: `public static class InversionOfControlConfigurator` with `public static IServiceCollection Add<Layer>Dependencies(this IServiceCollection services, IConfiguration? configuration = null)`, returning `services` for chaining.
- Host `AddDependencies(configuration)` chains framework infrastructure → Application → External → Persistence → Projections → Transactions → hosted services.
- Lifetimes: services, units, repositories, DbContext → **Scoped**. Producers, queues, factories, providers, settings → **Singleton**. Stateless lightweight helpers → Transient. Never inject a scoped service into a singleton; use `IServiceScopeFactory`.
- Typed `HttpClient`s via `AddHttpClient<TClient>()` with base address and resilience configured in the configurator.

## Variants

- **Microservice**: host = ASP.NET Core (see `dotnet-webapi-host` instructions), containerized, configuration from environment and Key Vault.
- **Desktop/worker**: host = Generic Host (see `dotnet-desktop-host` instructions). Persistence may be SQLite or a local store, but ports and layering are identical. UI/view-models only talk to `Application.Abstractions`.
- **Library/NuGet package**: no host; expose an `Add<Package>(this IServiceCollection)` configurator and keep implementations `internal`.
