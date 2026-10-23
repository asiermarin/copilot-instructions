# Coverage and Mutation Testing

## Coverage

Unit tests use `coverlet.msbuild`. Integration tests use `coverlet.collector`. Output is OpenCover, consumed by SonarQube.

```powershell
dotnet test <Root>.UnitTests -c Release /p:CollectCoverage=true /p:CoverletOutputFormat=opencover /p:CoverletOutput=./TestResults/unit.coverage.opencover.xml
dotnet test <Root>.IntegrationTests -c Release --collect:"XPlat Code Coverage" -- DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Format=opencover
```

- Target: ≥ 80% line coverage on new and changed code (SonarQube "new code" gate).
- Exclude only generated code, migrations, `Program`/composition roots, and test helpers (`[ExcludeFromCodeCoverage]`). Never exclude business logic to reach the target.

## Mutation Testing (Stryker.NET)

Configuration: `stryker-config.json` at the repository root. Runs against the UnitTests project, `mutation-level: Standard`, thresholds `high: 80`, `low: 60`. `target-framework` must match the test project TFM.

```powershell
dotnet tool install -g dotnet-stryker
dotnet stryker --config-file stryker-config.json
dotnet stryker --config-file stryker-config.json --mutate "**/Services/AssetService.cs"
dotnet stryker --config-file stryker-config.json --since:main
```

The HTML report is written to `StrykerOutput/<timestamp>/reports/mutation-report.html`.

## Killing Surviving Mutants

| Survivor type | Typical cause | Fix |
|---|---|---|
| Equality/relational (`>` → `>=`) | No boundary test | `[TestCase]` with values at, below and above the boundary |
| Boolean / negation | Only one branch tested | Test both branches with explicit outcomes |
| Statement removal (call removed) | Side effect not verified | `Verify(..., Times.Once)` on persist/broadcast/enqueue |
| Linq (`Any` → `All`, `First` → `Last`) | Single-element data | Use multi-element data where order/selection matters |
| String/constant | Message or value not asserted | Assert the returned value; for exceptions assert the type (and the message only if it is part of the contract) |
| Null-coalescing | Missing null input case | Add a test with null/missing data |

- Treat a surviving mutant in new code as a missing assertion. Add the test, or explain in the PR why the mutant is equivalent.
- Don't add `ignore-methods` entries to hide real logic. Only logging calls are ignored by default.
