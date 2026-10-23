---
description: 'Organization C# coding standard (single source of truth): naming, functions, clean code, modern language usage, async, error handling, logging, configuration, security and commit format. Applies to microservices, desktop apps, workers and libraries.'
applyTo: '**/*.cs'
---

# C# Coding Standard

Companion instructions: `dotnet-architecture`, `dotnet-solid-design`, `dotnet-testing`, `dotnet-webapi-host`, `dotnet-desktop-host`. Companion skills: `dotnet-scaffold-solution`, `dotnet-add-feature`, `dotnet-write-tests`.

## Precedence

- `.editorconfig`, `Directory.Build.props` and analyzer settings in the repository win on formatting.
- When nearby code already follows this standard, match it. When it doesn't, write new code to this standard, and don't refactor untouched code unless asked.

## Platform

- Target the framework the solution uses (currently `net10.0`) with the default latest C# version. Nullable and ImplicitUsings enabled.
- Don't introduce APIs or packages that block the solution's target framework.
- Analyzers on (`EnableNETAnalyzers`, `EnforceCodeStyleInBuild`, `AnalysisLevel=latest`). Fix warnings instead of suppressing them. Suppressions need a one-line justification.

## Files and Namespaces

- One public type per file. The file name equals the type name.
- File-scoped namespace equal to project root namespace + folder path.
- `using` directives go after the file-scoped namespace line (inside the namespace), `System.*` first, no blank lines between groups (IDE0065 is an error).
- No `#region`.

## Naming

Variable names should be able to describe what type of variable it is and what it is used for. Avoid trivial names; a long, descriptive name is preferable to a short, ambiguous one. Variable names should describe what they are.

| Element | Convention | Example |
|---|---|---|
| Namespace, type, method, property, event, constant | PascalCase | `TenantService`, `MaxBatchSize` |
| Interface | `I` + PascalCase | `ITenantReadRepository` |
| Private/protected fields | `_camelCase` | `_batchSize` |
| Parameters, locals, primary-constructor parameters | camelCase | `tenantGuid`, `transactionUnit` |
| Async method | `Async` suffix | `GetTenantByGuidAsync` |
| Boolean | `Is`/`Has`/`Can`/`Should` prefix | `IsArchived`, `HasLicenses` |
| Generic parameter | `T` + descriptive | `TSource`, `TResponse` |
| Enum | Singular; plural only for `[Flags]` | `UserType`, `MessageType` |
| Acronyms | 2 letters upper, 3+ PascalCase (new code) | `IO`, `MfaEnabled`, `HttpClient` |

Type suffixes by role:

| Suffix | Role |
|---|---|
| `Service` / `I…Service` | Use case or outbound port |
| `ReadRepository` / `Repository` | Read / write persistence port and adapter |
| `ProjectionUnit` / `TransactionUnit` | Read / write unit of work |
| `Mappers` | Static mapping class per entity |
| `Handler` | Inbound message consumer |
| `Worker` / `BackgroundService` | Hosted background processing |
| `Queue`, `Command` | In-process work queue and its item |
| `Configurator` | DI/configuration extension class |
| `Settings` | Strongly typed options |
| `Request` / `Response` / `Dto` / `Message` | Contracts |
| `Factory`, `Provider`, `Extensions`, `Constants`, `Exception` | Usual meaning |

Method names: verb + noun in domain language (`CalculateEnabledLicenses`, `AssignAdminRolesAsync`).
- `Get…` returns the item or throws `NotFoundException`. `Find…` returns `null` when missing. `TryGet…` returns `bool` + `out`. `Exists…`/`Is…`/`Has…` return `bool`.
- Commands use intent verbs: `Create`, `Update`, `Delete`, `Assign`, `Sync`, `Toggle`, `Archive`.
- No abbreviations except well-known ones (`Id`, `Dto`, `Uri`, `Mfa`, `Url`).

## Classes and Types

- `sealed` by default. Leave unsealed only for designed base classes (`abstract`, protected extension points), EF entities that need lazy-loading proxies, or test seams a framework requires.
- Primary constructors for dependency injection. Use the parameters directly. Don't copy a parameter into a field that does the same job. Declare `private readonly` `_camelCase` fields only for derived values (`_batchSize = options.Value.BatchSize`).
- Smallest visibility possible: `public` for types used across projects, `internal` for project-private helpers (expose them to tests with `InternalsVisibleTo`), `private` for members.
- Contracts (requests, responses, DTOs, messages, queue commands): `sealed record` with `required` / `init` properties. Collections default to `[]` and use `IReadOnlyList<T>` / `IReadOnlyCollection<T>`.
- EF entities: classes (not records), `partial` allowed, `virtual` navigations, collections initialized with `= []`.
- Static classes only for stateless helpers, mappers, extension methods and constants.
- No magic strings or numbers: use `const`, `static readonly` or a `*Constants` static class (for example `AuthorizePolicy`, `ServiceConstants`).

## Functions

- Functions should do one thing, do it well, and that should be the only thing they do.
- The name of a function should express exactly what it does. If the function does what its name suggests, then this is a sign that it does just one thing.
- Order matters: public functions always come first in the vertical order (at the top). The order of private functions reflects each step. The aim is for the code to ‘tell a story’ from top to bottom.
- One responsibility per method. Aim for under 20 lines, with 40 as the ceiling. If the name needs "And", split it.
- The fewer arguments, the better; ideally, there should be none. This can be improved by using objects. At most 4 parameters. Group more into a request or options type.
- Ensure that no functionality that does not belong to the function slips in.
- Guard clauses and early returns, with at most 2 levels of nesting.
- Validate at boundaries with `ArgumentNullException.ThrowIfNull`, `ArgumentException.ThrowIfNullOrWhiteSpace` and `ArgumentOutOfRangeException.ThrowIfNegativeOrZero`. Trust nullable annotations inside the core. Never use `null!` to silence the compiler, except for properties that EF or a serializer must assign.
- Extract pure computations into `private static` methods (deterministic, easy to test), for example `CalculateRoleChanges`.
- Command/query separation: a method either changes state or returns data. Returning the id of a created item is the only exception.
- No boolean flag parameters that switch behavior. Write two intention-revealing methods or use an enum.
- Return empty collections, never `null`.
- Expression-bodied members for single-expression bodies.

## Expressions

- `var` when the type is obvious from the right-hand side, otherwise an explicit type.
- `is null` / `is not null`, property patterns, and switch expressions to map values. Prefer switch expressions over switch statements.
- Collection expressions (`[]`), target-typed `new()`, `nameof(...)` instead of string literals, raw string literals for multi-line text.
- LINQ method syntax, one operator per line in long chains, no side effects inside LINQ.
- Avoid `dynamic`, reflection on hot paths, `goto`, and `Tuple<…>` in public APIs (use records).

## Async

- Async all the way. Never `.Result`, `.Wait()` or `GetAwaiter().GetResult()`.
- Every public async method takes `CancellationToken cancellationToken = default` as its last parameter and passes it to every awaited call, including EF (`ToListAsync(cancellationToken)`).
- Return `Task` / `Task<T>`. Use `ValueTask` only on measured hot paths. No `async void` except UI event handlers.
- No `ConfigureAwait(false)` in application code. Use it in reusable libraries and NuGet packages.
- No fire-and-forget tasks. Use an in-process queue + `BackgroundService` worker (`IAtlassianQueue` + `AtlassianQueueWorker` pattern) that creates a DI scope per item with `IServiceScopeFactory.CreateAsyncScope()`.
- `await using` for `IAsyncDisposable` (scopes, transactions, connections).

## Error Handling

- Expected business failures throw the framework exceptions (`NotFoundException`, `BadRequestException`, `ForbiddenException`, `UnauthorizedAccessException`). The host translates them: ProblemDetails for web, user messages for desktop.
- Typical pattern: `?? throw new NotFoundException($"Tenant with Guid: {tenantGuid} does not exist.");`
- Catch only to add context, to translate at an adapter boundary, or to keep a worker/handler loop alive (log and continue). Never catch-log-rethrow, never swallow silently, and never catch `Exception` in core logic.
- Exception messages name the operation and the identifiers. Never include secrets or personal data.
- Create custom exception types only when no framework type fits and a caller handles them differently.

## Logging

- Inject `ILogger<T>` (not `ILoggerFactory`) in new code. In tests use `NullLogger<T>.Instance`.
- Message templates with PascalCase named placeholders: `logger.LogInformation("Processing {MessageType} for tenant {TenantGuid}", message.Type, tenantGuid);`. Never use interpolation or concatenation inside log calls.
- Levels:
  - `Debug`: diagnostics
  - `Information`: business milestones
  - `Warning`: unexpected situations that were handled
  - `Error`: a failed operation; pass the exception as the first argument
  - `Critical`: the service is unusable
- Never log secrets, tokens, passwords, sensitive request bodies or personal data beyond identifiers.

## Configuration

- Strongly typed `sealed class <Name>Settings` with `public const string SectionName`, `{ get; init; }` properties and DataAnnotations.
- Register with `services.AddOptions<TSettings>().Bind(configuration.GetSection(TSettings.SectionName)).ValidateDataAnnotations().ValidateOnStart();`
- Consume via `IOptions<T>`, or `IOptionsMonitor<T>` when values must reload. Services never call `Environment.GetEnvironmentVariable` or `configuration["KEY"]` directly. Environment variables reach services through configuration providers. Legacy helpers such as `"KEY".GetRequiredVariable()` must not be extended.
- Secrets come from environment variables, Key Vault or user-secrets. They never go in committed `appsettings*.json` or code.

## Comments and Documentation

- As far as possible, avoid adding comments to the code. The code should be easy to understand and should make it clear what it does without the need for comments.
- Code says *what*. A comment only says *why* (a business rule, a workaround, a non-obvious constraint), in one short line.
- XML docs are required only on public ports in `*.Abstractions` projects and on public APIs of reusable packages. Elsewhere they are optional (CS1591 suppressed).
- No commented-out code. A `TODO` must reference a work item: `// TODO #12345: …`.

## Security

- Never hard-code secrets, keys or connection strings.
- Validate and sanitize all external input at the adapter boundary (contract validation, route constraints, message payload checks).
- EF LINQ or `FromSql` with interpolation only. Never `FromSqlRaw` with concatenated input.
- Authorize at the host boundary and scope every query by the current tenant in the application core.
- Use approved crypto libraries (the company `Cryptography` package). Never write custom crypto.

## Git

- Never commit code that fails to build or has failing tests.
- Commit format: `#<work-item ID>: <type>[<scope>][!]: <description>`, optional body and footers. `!` together with a `BREAKING CHANGE:` footer marks breaking changes. Ask for the work-item ID when it is unknown.
- Types: `feat`, `fix`, `test`, `refactor`, `style`, `docs`, `build`, `ci`, `perf`, `revert` (include reverted header and SHA), `chore` (package upgrades, removing obsolete code).
- Generated scripts, plans and scratch files go under `.github/.Artifacts/` (never the repository root) and are removed when no longer needed.
