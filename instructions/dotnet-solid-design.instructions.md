---
description: 'SOLID and design principles for C#/.NET with concrete patterns used in the reference architecture, and guidance on when NOT to apply a pattern.'
applyTo: '**/*.cs'
---

# SOLID and Design Principles

Apply each principle as it is applied in the reference architecture (`Lantek360.Licensing.Subscriptions.Backend`). A principle justifies a change only when it removes real coupling or duplication. Never add speculative abstractions.

## SOLID

### S: Single Responsibility
- A class has one reason to change:
  - controller = transport
  - service = use-case orchestration
  - repository = data access
  - mapper = shape conversion
  - handler = message intake
  - worker = background execution
- Business rules live in the application core, never in controllers, handlers, repositories or mappers.
- Signs a class needs splitting: more than ~7 constructor dependencies, more than ~500 lines, unrelated method clusters, or the word "And"/"Manager" in its name.

### O: Open/Closed
- Add new behavior by adding types, not by editing `switch` blocks scattered across the code:
  - a new `<Topic>Handler` for a new message
  - a new policy constant in `AuthorizePolicy` and its registration
  - a new strategy implementation registered in DI
- A single `switch` expression that maps an enum to behavior in one place is acceptable. Once the same switch appears twice, replace it with a strategy.

### L: Liskov Substitution
- Write repositories extend read repositories (`ITenantRepository : ITenantReadRepository`). Any write repository must honor the read contract (same not-found semantics, same filtering).
- Derived classes never throw `NotSupportedException` for inherited members and never tighten preconditions.
- Prefer composition when a base class would force irrelevant members on subclasses.

### I: Interface Segregation
- Separate read ports from write ports (`IProjectionUnit` vs `ITransactionUnit`). Query-only use cases depend on the projection side only.
- Keep service interfaces focused on one aggregate. Split an interface whose consumers each use a disjoint subset of its members.
- No "marker" interfaces and no god interfaces.

### D: Dependency Inversion
- The core depends on ports in `*.Abstractions`. Adapters (`Persistence.*`, `Application.External`, host) implement or consume them.
- Inject everything through constructors. No `new` for services, no service locator (`IServiceProvider.GetService`) outside composition roots and background workers that create scopes.
- Wrap static or ambient dependencies behind a port when they affect behavior under test (environment, file system, clock, random, HTTP).

## Other Principles

- **KISS**: the simplest code that meets the requirement. A plain method beats a pattern.
- **YAGNI**: no options, parameters, layers or interfaces for hypothetical needs. An interface with one implementation is justified only when it is a port (crosses a layer) or a test seam.
- **DRY**: extract on the third repetition of the same knowledge (not the same syntax). Shared query logic goes into `IQueryable` extensions (`ExecutePaginatedQueryAsync`); shared mapping goes into `*Mappers`.
- **Law of Demeter**: talk to direct collaborators. Exposing repositories through units (`transactionUnit.TenantRepository`) is the accepted exception.
- **Composition over inheritance**: inheritance is reserved for framework base types (`ControllerBase`, `BackgroundService`, `BaseLicensingHandler<T>`) and small, stable bases (`BaseRepository<T>`, `BaseService`).
- **Fail fast**: validate at the boundary, throw specific exceptions early, use `ValidateOnStart` for configuration.
- **Explicit over magic**: explicit DI registration in configurators, explicit mapping, no assembly scanning unless the framework requires it.
- **Immutability**: contracts are records with `init`. Mutate EF entities only inside a use case before `CompleteAsync`.
- **Tell, don't ask**: put a behavior that depends only on an entity's own state on that entity (or a mapper/helper), not in every caller.

## Pattern Catalog

| Pattern | Use it for | Reference | Don't use it when |
|---|---|---|---|
| Repository | Encapsulating EF queries per aggregate | `TenantReadRepository`, `TenantRepository : BaseRepository<Tenant>` | Wrapping a single trivial `DbSet` call that no use case shares |
| Unit of Work | One `SaveChanges` per use case; read/write split | `IProjectionUnit`, `ITransactionUnit.CompleteAsync` | Never call `SaveChanges` from repositories |
| Factory | Creating configured infrastructure objects | `IProducerFactory.CreateProducer()`, `ITaskFactory` | `new` is enough and creation has no logic |
| Strategy | Interchangeable algorithms selected at runtime (per product, per message type) | DI-registered `I<X>Strategy` + resolver | Only one variant exists |
| Decorator | Cross-cutting concerns around a port (caching, retry, metrics) | Decorate the `I<X>Service` registration | The concern is handled by middleware or `HttpClient` handlers |
| Queue + Worker | Decoupling slow or unreliable outbound calls | `IAtlassianQueue` + `AtlassianQueueWorker` | The caller needs the result synchronously |
| Message Handler | Consuming integration events | `UserHandler`, `Tenant2FAHandler : BaseLicensingHandler<T>` | Only for in-process calls (just call the service) |
| Options | Typed, validated configuration | `<Name>Settings` + `ValidateOnStart` | Never read raw environment variables in services |
| Expression Mapper | EF projection + in-memory mapping from one definition | `TenantMappers.ToTenantResponseExpr` / `ToTenantResponse()` | Never use reflection-based mappers |
| Middleware / Filter | HTTP cross-cutting concerns (logging, exception translation) | `RequestResponseLoggerMiddleware` | Business rules |

## Code Smells to Refactor When Touched

- Bool flag parameters (`GetTenantByGuidAsync(guid, includes: true)`): split into intention-revealing methods.
- Services reading `IConfiguration`/environment directly: move to `IOptions<T>`.
- `ILoggerFactory` injected only to create a logger: inject `ILogger<T>`.
- Primary-constructor parameters copied into fields with the same name: use the parameter.
- Static mocks shared between tests: create mocks per test in `[SetUp]`.
- Business rules duplicated in controller and service: keep them in the service.
