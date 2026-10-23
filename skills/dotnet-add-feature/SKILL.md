---
name: dotnet-add-feature
description: 'Add a feature or use case end-to-end to a clean/hexagonal .NET solution: contracts, ports, entity and EF configuration, read/write repositories and units, mapper, application service, DI registration, controller or desktop/worker adapter, migration and tests. USE FOR: new endpoint, new use case, new aggregate/entity, new CRUD resource, new message handler, extend service with new operation. DO NOT USE FOR: creating a new solution (use dotnet-scaffold-solution), writing tests only (use dotnet-write-tests).'
argument-hint: 'Describe the feature: aggregate/entity, operations, who calls it (HTTP, message, UI), authorization'
---

# Add a Feature Across the Layers

Implements a use case following `dotnet-architecture`, `csharp` and `dotnet-solid-design` instructions. Code templates are in [templates.md](./references/templates.md). The example aggregate is `Asset`; replace it with the real name.

## 1. Understand Before Coding

- Find the closest existing feature in the solution and read its contract, service, repository, mapper, controller/handler and tests. Match its conventions when they comply with the standard.
- Decide:
  - read-only (projection side only) or write (transaction side)
  - driving adapter: HTTP controller, message handler, UI, or worker
  - authorization policy and tenant scoping
  - outbound effects: broadcast event, enqueue an external call
- Ask for missing business rules instead of inventing them.

## 2. Implement Inside-Out

Work in this order. Each step compiles before moving on.

1. **Contracts** (`Application.Contracts/Entities/Requests|Responses`): `sealed record` requests/responses with `required`/`init` and validation attributes. Add enums to `Contracts/Enums` (don't reference persistence enums).
2. **Entity** (only for new data, in `Persistence.Entities/Entities`): `partial class`, `long` key + `Guid` public id, `virtual` navigations, `= []` collections.
3. **EF configuration** (`Persistence`): keys, unique index on the Guid, max lengths, relationships, delete behavior. Add the `DbSet<T>` to the context and the `I<Service>Context` port if one exists.
4. **Driven ports** (`Persistence.Abstractions`): `IAssetReadRepository` in `ReadRepositories`, `IAssetRepository : IAssetReadRepository, IBaseRepository<Asset>` in `Repositories`. Add properties to `IProjectionUnit` / `ITransactionUnit`.
5. **Persistence adapters**:
   - `AssetReadRepository` (Projections, `AsNoTracking`, projections via mapper expressions, `NotFoundException` on missing)
   - `AssetRepository : BaseRepository<Asset>` (Transactions, tracked)
   - wire both into `ProjectionUnit` / `TransactionUnit` as lazy properties
6. **Mapper** (`Application/Mappers/AssetMappers.cs`): `ToAssetResponseExpr` expression + `ToAssetResponse()` / `ToAsset()` extensions.
7. **Driving port** (`Application.Abstractions/Services/IAssetService.cs`): async methods with `CancellationToken cancellationToken = default`. XML doc summary on each member.
8. **Application service** (`Application/Services/AssetService.cs`): `sealed`, primary constructor, flow = guard → load → rules (private static helpers) → persist with one `CompleteAsync` → broadcast → map.
9. **DI**: register the service in `Application/Configurators/InversionOfControlConfigurator.cs` (Scoped). New outbound adapters go in their own layer configurator.
10. **Driving adapter**:
    - HTTP: an action in `Controllers/Api/AssetsController.cs` (policy constant, versioned route, `CancellationToken`, correct status codes). Add new policies to `Authorize/AuthorizePolicy.cs`.
    - Message: `<Topic>Handler : BaseLicensingHandler<TMessage>` delegating to the service, plus a hosted-service registration in the host configurator.
    - Desktop/worker: a view-model/presenter or worker that creates a scope per operation and calls the service.
11. **Migration** (when the schema changed): `dotnet ef migrations add <PascalCaseName> --context <Service>Context --project <Root>.Persistence --startup-project <Root>`. Review the generated SQL. Never edit merged migrations.

## 3. Tests (Same Change)

Use the `dotnet-write-tests` skill:
- Unit tests for the service (each rule, guard, not found, forbidden, persistence and broadcast verification), the controller/handler, and non-trivial mapper/helper logic.
- Integration test for the use case through real DI + SQLite when it touches new queries or schema.
- Feature (E2E) scenario when a new public endpoint is added.

## 4. Verify

- `dotnet build -c Release` passes with no new warnings.
- `dotnet test` passes for UnitTests and IntegrationTests.
- Self-review against the checklist:
  - [ ] No layer violates the dependency rule. The controller/handler only calls `I*Service`.
  - [ ] Every async method propagates `CancellationToken`.
  - [ ] A single `CompleteAsync` per use case. Reads use the projection unit.
  - [ ] Tenant scoping is enforced in the service.
  - [ ] No secrets, no raw configuration reads, structured logging only.
  - [ ] Tests named `Method_Scenario_ExpectedResult` with AAA comments.
- Propose a commit message: `#<work-item ID>: feat(<scope>): <description>`.
