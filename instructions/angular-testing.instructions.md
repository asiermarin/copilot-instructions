---
description: 'Testing standard for Angular: Jest + jest-preset-angular + TestBed stack, naming (describe/should-when), mandatory AAA comments, mocking with jest.fn/jest.Mocked, HttpTestingController, standalone components, signals and signal inputs, functional guards and interceptors, dialogs, async (fakeAsync), i18n mock, coverage thresholds and Sonar reporting.'
applyTo: '**/*.spec.ts, **/jest.config.js, **/jest.config.ts, **/setup.jest.ts, **/src/__mocks__/**'
---

# Angular Testing Standard

Companion instructions: `typescript-angular`, `angular-architecture`, `angular-solid-design`. Companion skill: `angular-write-tests`.

Reference implementation: `Licensing.Subscriptions.Frontend` (37+ specs).

## Mandated Stack

| Concern | Tool |
|---|---|
| Runner | Jest (`jest --coverage`) with `jest-preset-angular` |
| Environment | `jsdom`, zone test env (`setupZoneTestEnv()` in `setup.jest.ts`) |
| Angular harness | `TestBed`, `ComponentFixture`, `HttpTestingController` |
| Mocks | `jest.fn()`, `jest.spyOn()`, typed as `jest.Mocked<T>` |
| i18n | `moduleNameMapper` → `src/__mocks__/@ngx-translate/core.ts` (pipe and service return the key) |
| Reports | `lcov` + `text-summary` coverage, `jest-sonar` → `coverage/sonar-report.xml` |

No Karma, Jasmine, Protractor or `jasmine.createSpyObj`. Spectator is allowed only where a repo already uses it consistently.

## Test Scope

- **Unit tests are the default:** one class/function under test, all collaborators mocked.
- Services: real service + `HttpTestingController`; mock `ToastService`, `ErrorHandlerService`, other services.
- Components: real component (shallow): standalone import + mocked services. Override the template (`overrideComponent(..., { set: { template: '' } })`) only to test pure logic of heavy layout components.
- Guards/interceptors/resolvers: execute in `TestBed.runInInjectionContext`.
- Pure functions (mappers, validators, pipes): plain Jest, no TestBed.
- E2E is out of scope of this standard.

## Naming and Structure

```ts
describe('UsersService', () => {              // class / function under test
  describe('deleteUser', () => {              // method under test
    it('should show a success toast when the user is deleted', () => { … });
    it('should delegate to the error handler when the request fails', () => { … });
  });
});
```

- Outer `describe` = exact class or function name. Inner `describe` = method or behavior group.
- `it('should <expected result> when <scenario>')`. The `when` clause is required except for the creation smoke test (`it('should create')`).
- Every test body has `// Arrange`, `// Act`, `// Assert` comments (use `// Act & Assert` only when the assertion is the act, e.g. `expect(() => fn()).toThrow()`). Omit `// Arrange` only if there is nothing to arrange.
- One behavior per test. Multiple `expect`s are fine when they verify that one behavior.
- Tests are independent of order; no shared mutable state between tests.
- Spec file sits next to the source file: `users.service.ts` → `users.service.spec.ts`.

## Setup

- Fresh mocks and `TestBed.configureTestingModule` in `beforeEach`. Never at module level.
- Typed mocks:

```ts
let usersService: jest.Mocked<UsersService>;
usersService = {
  getPaginatedUsers: jest.fn().mockReturnValue(of(PAGED_USERS)),
  deleteUser: jest.fn().mockReturnValue(of(void 0)),
} as unknown as jest.Mocked<UsersService>;
```

- No `any` for mocks. Use `jest.Mocked<T>` or `Partial<T>`.
- Provide mocks with `{ provide: X, useValue: xMock }`. Never mock the class under test.
- Test data as `const` fixtures at the top of the spec (UPPER_SNAKE for shared fixtures, e.g. `USER_RESPONSE`) or small builder functions (`buildUser(overrides)`). Reuse across tests with spread overrides.
- `afterEach(() => httpMock.verify())` in every spec using `HttpTestingController`.
- `jest.clearAllMocks()` isn't needed when mocks are recreated in `beforeEach`.

## Services (HTTP)

- Providers: the service, `provideHttpClient()`, `provideHttpClientTesting()`, mocked collaborators.
- For each method verify: URL (built from `environment`), HTTP method, query params / body, mapped result, success toast, error delegation.

```ts
it('should request the paginated users when called with filters', () => {
  // Arrange
  let result: IPaginatedResponse<IUserResponse> | undefined;

  // Act
  service.getPaginatedUsers(1, REQUEST).subscribe(response => (result = response));
  const req = httpMock.expectOne(r => r.url === `${environment.subscriptionsApiUri}/api/v1.0/Users/paginated`);
  req.flush(PAGED_USERS);

  // Assert
  expect(req.request.method).toBe('GET');
  expect(req.request.params.get('page')).toBe('1');
  expect(result).toEqual(PAGED_USERS);
});
```

- Error path: `req.flush(body, { status: 500, statusText: 'Server Error' })` and assert `errorHandler.handleError` was called and the error propagates.

## Components

- `imports: [ComponentUnderTest, NoopAnimationsModule]`, providers with mocks, `provideTranslateService()` from the mock, `provideRouter([])` when the template uses `routerLink`.
- `fixture.componentRef.setInput('name', value)` for signal inputs; then `fixture.detectChanges()`.
- Read signals directly: `expect(component.users()).toEqual([...])`.
- Outputs: `const emitted = jest.fn(); component.tenantSelected.subscribe(emitted);`.
- Assert rendered DOM only for meaningful behavior (visibility by role, disabled state, emitted events on click), via `fixture.nativeElement.querySelector('[data-testid="…"]')`. Add `data-testid` attributes when selectors would be brittle.
- Forms: `component.form.setValue({...})`, assert `valid`/`errors` and the mapped request sent to the service.
- Navigation: mock `Router` (`{ navigate: jest.fn(), navigateByUrl: jest.fn() }`) and assert the call.

## Guards, Interceptors and Resolvers

```ts
const executeGuard: CanActivateFn = (...args) =>
  TestBed.runInInjectionContext(() => tenantsGuard(...args));

it('should redirect to unauthorized when the user has no allowed role', async () => {
  // Arrange
  authService.isSuperAdmin.mockReturnValue(false);

  // Act
  const result = await firstValueFrom(executeGuard(ROUTE, STATE) as Observable<boolean | UrlTree>);

  // Assert
  expect(result).toBe(false);
  expect(router.navigateByUrl).toHaveBeenCalledWith('/unauthorized');
});
```

- One test per allowed role and one deny test.
- Interceptors: `provideHttpClient(withInterceptors([interceptor]))` + `provideHttpClientTesting()`, then assert headers/URL on the captured request.

## Async

- Observables from mocks: `of(value)` (sync), `throwError(() => error)` for failures, `Subject` when the test controls timing.
- Timers, debounce, dialogs `afterClosed()`: `fakeAsync` + `tick(ms)` / `flush()`.
- Promises: `async` test + `await fixture.whenStable()` or `firstValueFrom`.
- Never `setTimeout`, real timers or `done` callbacks with arbitrary waits.

## Dialogs

- Mock `MatDialog.open` to return `{ afterClosed: () => of(result) }` and assert both the `open` arguments (component + data) and the effect of each result (`true`, `false`/`undefined`).
- Dialog components: provide `MAT_DIALOG_DATA` and a `MatDialogRef` mock (`{ close: jest.fn() }`), assert `close` with the expected result.

## Required Scenarios

For each unit, cover what applies:

- happy path
- each validation / guard failure
- empty results and `null`/missing optional data
- HTTP error path
- each role that changes behavior (allowed and denied)
- boundary values (first/last page, max length)
- side effects: toast, navigation, dialog, emitted output, state service update
- for bug fixes: a regression test that fails without the fix

## Coverage

- `jest.config.js` enforces:

```js
coverageThreshold: {
  global: { statements: 80, lines: 80, functions: 80, branches: 70 },
},
```

- Exclude only bootstrap and pure config from coverage (`main.ts`, `environments/`, `*.routing.ts`, `app.config.ts`) via `collectCoverageFrom` negations.
- Changed lines in a PR are ≥ 80% covered (Sonar quality gate reads `coverage/lcov.info` and `coverage/sonar-report.xml`).
- Don't write assertion-less tests to raise coverage; every test asserts behavior.

## Forbidden

- `any` in specs, `// @ts-ignore`, `fit`/`fdescribe`/`xit` committed, `console.log`.
- Testing private methods directly (`component['privateMethod']`). Test through the public/protected surface.
- Snapshot tests for components.
- Real HTTP, real timers, real `localStorage` without a mock.
