---
name: dotnet-write-tests
description: 'Write or fix .NET tests following the organization standard (NUnit + Moq + Shouldly): unit tests, integration tests (real DI + SQLite in-memory / WebApplicationFactory), feature/E2E tests against deployed environments, 2FA/MFA test scenarios, coverage and Stryker mutation testing. USE FOR: add unit tests, test this service/controller/handler, regression test for bug, integration test for repository or endpoint, E2E/feature test, MFA/2FA tests, improve mutation score, kill surviving mutants. DO NOT USE FOR: running/filtering tests only (use run-tests).'
argument-hint: 'Class/method or feature to test, and test type (unit | integration | feature | mfa | mutation)'
---

# Write .NET Tests

Follow the `dotnet-testing` instructions. This skill picks the test type, then applies the matching template.

## 1. Choose the Test Type

| You need to verify | Test type | Reference |
|---|---|---|
| Logic of one class (service, handler, controller, mapper, helper) | Unit | [unit-tests.md](./references/unit-tests.md) |
| EF queries, DI wiring, migrations/schema, several layers together | Integration | [integration-tests.md](./references/integration-tests.md) |
| The HTTP pipeline (routing, auth policies, ProblemDetails) without external systems | Integration (`WebApplicationFactory`) | [integration-tests.md](./references/integration-tests.md#http-pipeline) |
| A deployed environment end-to-end with real identity | Feature (E2E) | [feature-e2e-tests.md](./references/feature-e2e-tests.md) |
| Two-factor / MFA behavior at any level | Scenario matrix | [mfa-2fa-tests.md](./references/mfa-2fa-tests.md) |
| Test quality (surviving mutants, coverage gaps) | Mutation / coverage | [mutation-coverage.md](./references/mutation-coverage.md) |

Default to unit tests. Add an integration test when the behavior depends on EF translation, the database schema or DI composition. Add a feature test when a public endpoint is new or its contract changes.

## 2. Procedure

1. Read the production code under test and the closest existing test class (same folder in the mirrored test project). Reuse its fixtures, builders and Tests.Common helpers.
2. List the scenarios before writing code:
   - the happy path
   - each guard/validation failure
   - not found
   - forbidden or tenant mismatch
   - boundary values
   - side effects: persist, broadcast, enqueue
   - for bug fixes, the regression scenario
3. Create or extend `<ClassUnderTest>Tests` in the mirrored folder. Name methods `Method_Scenario_ExpectedResult` and use `// Arrange`, `// Act`, `// Assert` comments.
4. Build the SUT in `[SetUp]` with fresh mocks. Use Tests.Common builders and collections for data.
5. Assert with Shouldly. Verify mock interactions only when the interaction is the behavior.
6. Run the tests (`dotnet test <TestProject> --filter "FullyQualifiedName~<ClassUnderTest>Tests"`), make them pass, then confirm a regression test fails without the fix.
7. For services with new business rules, run Stryker on the changed files and kill surviving mutants (see mutation-coverage).

## 3. Done When

- [ ] Every listed scenario has a test, and the tests are independent of execution order.
- [ ] No `static` mocks, no `Thread.Sleep`, no real network or secrets in unit/integration tests.
- [ ] Only NUnit, Moq and Shouldly (no xUnit, MSTest or FluentAssertions).
- [ ] Tests pass locally. The coverage of changed lines is ≥ 80%.
