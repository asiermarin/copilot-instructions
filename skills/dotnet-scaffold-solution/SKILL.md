---
name: dotnet-scaffold-solution
description: 'Scaffold a new .NET solution following the organization clean/hexagonal architecture: microservice (ASP.NET Core), desktop app, worker or library. Creates all layer projects, references, configurators, test projects, Directory.Build.props, .editorconfig and stryker-config. USE FOR: new microservice, new backend, new desktop app, new worker service, new solution skeleton, bootstrap .NET project with clean architecture. DO NOT USE FOR: adding a feature to an existing solution (use dotnet-add-feature).'
argument-hint: '<Company>.<Domain>.<Service> and host type (backend | desktop | worker | library)'
---

# Scaffold a Clean-Architecture .NET Solution

Creates a solution with the same layout as `Lantek360.Licensing.Subscriptions.Backend`. Follow the `dotnet-architecture` instructions for the rules behind every step.

## Inputs (ask if missing)

1. Base name `<Company>.<Domain>.<Service>`, e.g. `Lantek360.Licensing.Subscriptions`.
2. Host type: `backend` (ASP.NET Core microservice), `desktop`, `worker`, or `library`.
3. Database provider: `SqlServer` (default for backend), `Sqlite` (default for desktop), or `none`.
4. Messaging needed (Kafka/streaming handlers + broadcast)? Default: no.
5. Target framework. Default: `net10.0`.

Set `<Root>` = `<Company>.<Domain>.<Service>.<HostSuffix>` where HostSuffix is `Backend`, `Desktop`, `Worker` (omit it for `library`).

## Procedure

1. **Solution and shared files** in the repository root:
   - `dotnet new sln -n <Root>` (or `.slnx` if the team uses it).
   - Copy [Directory.Build.props](./assets/Directory.Build.props), [.editorconfig](./assets/.editorconfig) and [stryker-config.json](./assets/stryker-config.json). Replace the `<Root>` placeholders and the TFM.
   - `dotnet new gitignore`.
2. **Create projects** following [project-layout.md](./references/project-layout.md). Use `classlib` for every layer, `webapi --use-controllers` for a backend host, `console`/`worker` or the UI template for other hosts, and `nunit` for test projects. Remove `Class1.cs`, `UnitTest1.cs` and template weather samples.
3. **Remove duplicated properties** from each generated `.csproj` (`Nullable`, `ImplicitUsings`) because `Directory.Build.props` sets them. Keep `TargetFramework`.
4. **Add project references** exactly as in the dependency table of `project-layout.md`. Don't add references that aren't listed.
5. **Add packages** per project (latest stable versions compatible with the TFM):
   - Persistence: `Microsoft.EntityFrameworkCore`, the provider package, `Microsoft.EntityFrameworkCore.Design` (host only, `PrivateAssets=all`).
   - Application / Persistence.Abstractions: `Microsoft.EntityFrameworkCore` (abstractions only, no provider).
   - Backend host: `Asp.Versioning.Mvc`, `Swashbuckle.AspNetCore` or `Microsoft.AspNetCore.OpenApi`.
   - UnitTests: `NUnit`, `NUnit3TestAdapter`, `Microsoft.NET.Test.Sdk`, `Moq`, `Shouldly`, `coverlet.msbuild`.
   - IntegrationTests: same as UnitTests but `coverlet.collector` instead of `coverlet.msbuild`, plus `Microsoft.EntityFrameworkCore.Sqlite` and (backend) `Microsoft.AspNetCore.Mvc.Testing`.
   - FeatureTests: `NUnit`, `NUnit3TestAdapter`, `Microsoft.NET.Test.Sdk`, `Shouldly`, `coverlet.collector`.
   - Company framework packages (`<Company>.Framework.*`) when available, for exceptions, tenant context, logging, streaming and test utils.
6. **Create the skeleton code** (templates in [project-layout.md](./references/project-layout.md#skeleton-code)):
   - `Configurators/InversionOfControlConfigurator.cs` in every layer with `Add<Layer>Dependencies`.
   - `Persistence.Abstractions/Units/IProjectionUnit.cs` and `ITransactionUnit.cs`, `Persistence.Transactions/Repositories/BaseRepository.cs`, `Units/ProjectionUnit.cs` and `Units/TransactionUnit.cs`.
   - `Persistence/Contexts/<Service>Context.cs` and a design-time factory.
   - Host entry point wiring the root configurator (backend: versioning, controllers, JSON options, exception → ProblemDetails middleware, health endpoints; desktop/worker: Generic Host).
   - Backend: `Authorize/AuthorizePolicy.cs`, `Dockerfile` (non-root, alpine runtime), `k8s/base` + `k8s/patches`.
   - Tests.Common: `Data/<Entity>Collection.cs`, `Builders/TestDataProvider.cs`, `Databases/SqliteContextFactory.cs`.
   - UnitTests: `Utils/TestAsyncQueryProvider.cs` and `.runsettings` with non-secret environment variables.
7. **Solution folders**: `Application`, `Persistence`, `Tests/Unit`, `Tests/Integration`, `Tests/Feature`, `Tests/Common`, `Solution Items` (`.editorconfig`, `Directory.Build.props`).
8. **Verify**: `dotnet build -c Release` with no warnings promoted to errors, then `dotnet test` (all projects compile; the placeholder smoke tests pass).

## Output Checklist

- [ ] Every project name matches `<Root>.<Layer>` and its root namespace.
- [ ] No reference violates the dependency rule (Application doesn't reference External/Persistence/Projections/Transactions).
- [ ] Each layer exposes exactly one `Add<Layer>Dependencies` extension.
- [ ] The host is the only composition root.
- [ ] `Directory.Build.props`, `.editorconfig` and `stryker-config.json` are present and the TFM matches.
- [ ] The build and tests pass.
