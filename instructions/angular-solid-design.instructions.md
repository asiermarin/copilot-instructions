---
description: 'SOLID and design principles for Angular/TypeScript with concrete patterns used in the reference micro-frontend (facade/wrapper, signal state service, functional guards and interceptors, injection tokens, strategy, mapper), when NOT to apply them, and code smells to refactor.'
applyTo: '**/src/app/**/*.ts'
---

# Angular SOLID and Design Principles

Companion instructions: `typescript-angular`, `angular-architecture`, `angular-testing`.

Apply a principle when it removes a real problem in the code at hand. Don't add abstractions "for the future".

## SOLID in Angular

### S — Single Responsibility

One reason to change per class.

| Class | Its only job |
|---|---|
| Page component | Orchestrate one screen: read params, call services, hold page state, navigate |
| Presentational component | Render inputs and emit outputs |
| Dialog component | Collect a decision/data and close with a result |
| API service | Talk to one backend resource |
| State service | Hold and expose one slice of shared state |
| Wrapper service | Adapt one third-party API (`ToastService` → `MatSnackBar`, `AuthService` → auth library) |
| Guard | Decide access to one route group |
| Interceptor | One cross-cutting HTTP concern |

Limits that signal a split: more than ~5 injected dependencies, more than ~300 lines in a component class, more than ~200 lines of template, methods named `…And…`.

### O — Open/Closed

- Add behavior by adding a provider, a route, a component or a strategy entry, not by growing `if/switch` chains in existing classes.
- One `switch` over a type in one place (e.g. a status → icon map) is fine; the same switch in several files is not. Replace it with a `Record<Status, Config>` lookup.
- Configure libraries through injection tokens (`SIDEBAR_CONFIG_TOKEN`, `IDENTITY_CONFIG_TOKEN`) instead of editing shared components.

### L — Liskov Substitution

- Mocks and alternative implementations provided under the same token honor the full contract (same return types, same observable completion semantics).
- A wrapper never throws "not supported" for a method its interface exposes.
- Prefer composition over component inheritance. Abstract base components are allowed only for truly identical lifecycle logic and must not require subclasses to call `super` in a specific order.

### I — Interface Segregation

- Small, focused services: `UsersService`, `TenantsService`, `RolesService`, not one `ApiService` with every endpoint.
- Presentational components expose only the inputs they render. Don't pass whole aggregates when two fields are needed.
- Separate request and response interfaces; don't reuse a response type as a create request.

### D — Dependency Inversion

- Pages depend on app services and wrappers (`AuthService`, `ToastService`), not on third-party internals.
- Provide configuration and swappable implementations through `InjectionToken<T>` with a typed interface.
- Access browser globals (`window`, `localStorage`, `matchMedia`) through an injected token or wrapper (`inject(DOCUMENT)`, a `WINDOW` token) so components stay testable.
- `inject()` everywhere; never `new` a service.

## Other Principles

- **KISS:** the simplest code that passes the tests. A signal + method beats a store library for one screen.
- **YAGNI:** no generic base service, store or abstraction until a third concrete use exists.
- **DRY:** extract on the third repetition (shared component, pipe, validator, constant). Two similar templates are not yet duplication.
- **Smart vs presentational:** data and side effects flow down from pages; events flow up from shared components.
- **Unidirectional data flow:** state lives in one place (page signal or state service); children receive it read-only.
- **Immutability:** update signals with new references (`update(list => [...list, item])`); never mutate inputs or state arrays in place.
- **Fail fast:** validate route params and required inputs early (`input.required`), redirect or show an error state immediately.
- **Explicit over magic:** typed tokens, explicit providers, explicit return types. No hidden global state.
- **Tell, don't ask:** `authService.isSuperAdmin()` instead of inspecting `userConfig.roles` in every component.
- **Law of Demeter:** templates bind to a component member, not `a.b.c.d`. Expose a `computed()`.

## Pattern Catalog

| Pattern | Use when | Reference | Don't use when |
|---|---|---|---|
| Facade / Wrapper service | A third-party API is used from several places or leaks types | `AuthService` (auth library), `ToastService` (`MatSnackBar`), `ErrorHandlerService` | The library call is used once and is already simple |
| Signal state service | State is shared across sibling routes/components | `TenantStateService` (`selectedTenant` via `asReadonly()`) | State belongs to a single page: keep it in the page component |
| Functional guard | Route access depends on role or state | `tenantsGuard`, `logsGuard` | The check is pure UI visibility inside an already-allowed page |
| Functional interceptor | Every request needs the same header, retry or error mapping | auth interceptor | Only one endpoint needs it: do it in the service |
| Resolver | The page cannot render without data and you want navigation to wait | `userConfigResolver` | A loading state in the page is acceptable (prefer that) |
| InjectionToken config | A library/shared component needs configuration per app | `SIDEBAR_CONFIG_TOKEN`, `IDENTITY_CONFIG_TOKEN` | A plain `input()` suffices |
| Strategy (lookup map) | Behavior varies by a closed set of types | `Record<UserType, Config>` | Two branches: an `if` is clearer |
| Mapper (pure function) | API shape differs from view/form shape | `toCreateRequest(form)` | Shapes are identical |
| Observer (RxJS) | Async streams, debouncing, cancellation | `switchMap` on filter changes | Synchronous state: use signals |
| Dialog as component | A decision or form needs modal UX | `ConfirmDialogComponent` + `afterClosed()` | Inline confirmation is enough |

## Code Smells to Refactor

| Smell | Refactor to |
|---|---|
| `subscribe` in a component with no cleanup | `toSignal`, `async` pipe, or `takeUntilDestroyed(destroyRef)` |
| Nested `subscribe` | `switchMap` / `concatMap` / `forkJoin` |
| Component injects `HttpClient` | Move the call to a `core/services/<domain>` service |
| Business logic / method calls in templates | `computed()` signal or pure pipe |
| `any` (`http.get<any>`, `Observable<any>`) | Proper interface or `unknown` + narrowing |
| `console.error` in `error` callbacks | Rely on `ErrorHandlerService`; restore UI state only |
| Hard-coded role strings or URLs | `environment` / `core/constants` |
| Same toast/dialog setup copied in several pages | Wrapper method or shared dialog component |
| Mutating `@Input`/`input()` objects | Emit an output or create a new object |
| `setTimeout` to "wait for" change detection | `afterNextRender`, signals, or fix the data flow |
| Boolean flag parameter (`save(isDraft: boolean)`) | Two intent-named methods |
| God page (> 300 lines, > 5 dependencies) | Extract presentational children, a state service or a form component |
| Shared component injecting `Router` or API services | Emit an output; let the page navigate/call |
| Logic duplicated between add and update pages | Shared form component in `share/components/forms/` |
