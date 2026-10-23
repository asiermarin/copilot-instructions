---
name: angular-write-tests
description: 'Write or fix Angular unit tests following the organization standard (Jest + jest-preset-angular + TestBed): API services with HttpTestingController, page and presentational components with signals and signal inputs, reactive forms, functional guards, interceptors and resolvers, dialogs and async flows (fakeAsync), state services, pipes and validators, coverage thresholds and Sonar report. USE FOR: add unit tests, write spec, test this component/service/guard/dialog, regression test for a bug, raise coverage, fix failing spec. DO NOT USE FOR: E2E/browser tests, .NET tests (use dotnet-write-tests).'
argument-hint: 'File/class to test (service | component | guard | interceptor | dialog | pipe | state service) and scenario or bug to cover'
---

# Write Angular Tests

Follow the `angular-testing` instructions. This skill picks the template for the unit under test and drives the procedure.

## 1. Choose the Template

| Unit under test | Reference |
|---|---|
| API service (`HttpClient`), state service, wrapper service | [service-tests.md](./references/service-tests.md) |
| Page component, presentational component, form component | [component-tests.md](./references/component-tests.md) |
| Functional guard, interceptor, resolver | [guard-interceptor-tests.md](./references/guard-interceptor-tests.md) |
| Dialog component, flows that open dialogs, debounce/timers | [dialog-async-tests.md](./references/dialog-async-tests.md) |
| Pure function, pipe, validator, mapper | Plain Jest, no TestBed (see [component-tests.md](./references/component-tests.md#pure-functions-pipes-and-validators)) |
| Coverage gaps, thresholds, Sonar | [coverage.md](./references/coverage.md) |

## 2. Procedure

1. Read the unit under test and the closest existing spec (same folder or a sibling feature). Reuse its mocks and fixtures.
2. List the scenarios before writing code:
   - happy path
   - each validation / guard failure
   - empty results, missing optional data
   - HTTP error path
   - each role that changes behavior (allowed and denied)
   - boundaries (first/last page, max length)
   - side effects: toast, navigation, dialog, emitted output, state update
   - for bug fixes, the regression scenario
3. Create or extend `<file>.spec.ts` next to the source. Structure: `describe('<Class>')` → `describe('<method>')` → `it('should <result> when <scenario>')`.
4. In `beforeEach`, build fresh typed mocks (`jest.Mocked<T>`) and configure `TestBed`. Shared fixtures as `const` at the top of the spec.
5. Write each test with `// Arrange`, `// Act`, `// Assert` comments. Assert behavior (returned values, state signals, calls with exact arguments), not implementation details.
6. Run the spec and make it pass:

   ```powershell
   npx jest src/app/<path>/<file>.spec.ts
   ```

   For a bug fix, confirm the regression test fails without the fix.
7. Run the full suite with coverage (`npm test`) and check thresholds.

## 3. Done When

- [ ] Every listed scenario has a test; tests are order-independent.
- [ ] Names follow `should … when …`; every test has AAA comments.
- [ ] No `any`, no `fit`/`fdescribe`/`xit`, no real timers or `setTimeout`, no real HTTP.
- [ ] `httpMock.verify()` in `afterEach` where `HttpTestingController` is used.
- [ ] `npm test` passes with the configured coverage thresholds.
