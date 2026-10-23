---
description: 'Clean architecture standard for Angular micro-frontends: folder layout (core / pages / share), layer responsibilities, dependency rule, standalone bootstrap and composition root, lazy routing and guards, models and DTOs, service kinds (API, state, wrapper), runtime environment configuration, authentication and i18n.'
applyTo: '**/src/app/**/*.ts, **/src/main.ts, **/src/environments/**/*.ts, **/angular.json'
---

# Angular Architecture Standard

Companion instructions: `typescript-angular`, `angular-solid-design`, `angular-testing`. Companion skills: `angular-scaffold-app`, `angular-add-feature`, `angular-write-tests`.

Reference implementation: `Licensing.Subscriptions.Frontend`.

## Core Rules

1. **Standalone only.** `bootstrapApplication(AppComponent, appConfig)` in `main.ts`. No new `NgModule`.
2. **Three areas with one-way dependencies:** `pages` → `share` → `core`. `core` depends on nothing in the app except `environments`.
3. **`app.config.ts` is the only composition root.** All application-wide providers (HTTP, interceptors, router, i18n, auth, layout, logging, animations) are registered there.
4. **Every feature is lazy-loaded** through its own `<feature>.routing.ts` and protected by a functional guard when access depends on roles.
5. **Only `core/services` talk to the backend.** Components never use `HttpClient`.
6. **The backend is the authority.** The frontend hides what the user can't do; the API enforces it.

## Folder Layout

```
src/
├── main.ts
├── styles.scss
├── environments/                    environment.ts | environment.development.ts | environment.prod.ts
├── assets/
│   ├── env.template.js              ${VARS} replaced at container start → environment/env.js
│   ├── environment/env.js           local placeholder (window.env)
│   └── i18n/<locale>.json           one file per supported locale
├── __mocks__/                       Jest module mocks (e.g. @ngx-translate/core)
└── app/
    ├── app.component.ts|html|scss
    ├── app.config.ts                composition root
    ├── app.routes.ts                shell + lazy feature routes
    ├── core/                        no UI
    │   ├── constants/               roles, api paths, page sizes
    │   ├── guards/                  <feature>.guard.ts (functional)
    │   ├── interceptors/            <name>.interceptor.ts (functional)
    │   ├── models/
    │   │   ├── enums/               <name>.enum.ts
    │   │   ├── <domain>/request/    <action>-<domain>-request.interface.ts
    │   │   ├── <domain>/response/   <domain>-response.interface.ts
    │   │   └── paginated-response.interface.ts
    │   └── services/
    │       ├── <domain>/            <domain>.service.ts (API service)
    │       ├── shared/              <name>-state.service.ts (cross-feature state)
    │       ├── auth/                auth.service.ts (wrapper over auth library)
    │       ├── error-handler/       error-handler.service.ts
    │       └── toast/               toast.service.ts
    ├── pages/                       smart components, one folder per feature
    │   └── <feature>/
    │       ├── <feature>.routing.ts export const <FEATURE>_ROUTES: Routes
    │       ├── list-<feature>/
    │       ├── add-<feature>/
    │       └── update-<feature>/
    └── share/                       reusable, presentational
        ├── components/
        │   ├── dialogs/<name>-dialog/
        │   ├── forms/<domain>-form/
        │   ├── full-layout/         authenticated shell (header, sidebar, router-outlet)
        │   └── <name>/
        ├── constants/               validation-reg-ex.constants.ts
        ├── pipes/ | directives/ | validators/
        └── wrappers/                legacy NgModule wrappers for third-party module routes only
```

## Layer Responsibilities

| Area | Contains | Responsibility | Must not |
|---|---|---|---|
| `core/models` | interfaces, enums | Typed contracts mirroring backend request/response DTOs | Contain classes with behavior, import Angular |
| `core/services/<domain>` | API services | One service per backend resource: build URL + params, call `HttpClient`, success toast, `catchError` | Hold UI state, open dialogs, navigate |
| `core/services/shared` | state services | Cross-feature state with signals (`TenantStateService`) | Call `HttpClient` directly when an API service exists |
| `core/services/auth`, `toast`, `error-handler` | wrappers / facades | Hide third-party APIs (auth library, `MatSnackBar`) behind a small app-specific interface | Leak third-party types into pages when avoidable |
| `core/guards` | functional guards | Route access by role / state; redirect to `/unauthorized` | Contain business rules beyond access checks |
| `core/interceptors` | functional interceptors | Cross-cutting HTTP concerns (headers, versioning, error mapping) | Show feature-specific UI |
| `pages/<feature>` | smart components + routes | Orchestrate: read route params, call services, hold page state, open dialogs, navigate | Be imported by another feature or by `share` |
| `share/components` | presentational components | Render inputs, emit outputs; dialogs receive `MAT_DIALOG_DATA` and close with a result | Inject API services or `Router` |
| `share/constants`, `pipes`, `validators` | pure helpers | Reusable, stateless | Depend on pages |

## Dependency Rule

| From \ May import | `core/models` | `core/services` | `core/guards`, `interceptors` | `share` | `pages/<same feature>` | `pages/<other feature>` |
|---|---|---|---|---|---|---|
| `core/models` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `core/services` | ✓ | ✓ | ✗ | only `share/components/toast` (snackbar content) and `share/constants` | ✗ | ✗ |
| `core/guards`, `interceptors` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `share` | ✓ | wrappers only (`ToastService`, `TranslateService`), and shared state services read-only | ✗ | ✓ | ✗ | ✗ |
| `pages/<feature>` | ✓ | ✓ | ✗ (routes reference guards) | ✓ | ✓ | ✗ |
| `app.routes.ts`, `app.config.ts` | ✓ | ✓ | ✓ | ✓ | ✓ (lazy `import()` only) | — |

If two features need the same component, move it to `share/`. If two features need the same state, move it to `core/services/shared/`.

## Bootstrap and Composition Root

- `main.ts`: `bootstrapApplication(AppComponent, appConfig).catch(…)` only.
- `app.config.ts` contains, in this order: change detection, router (`provideRouter(routes, withComponentInputBinding())`), HTTP (`provideHttpClient(withInterceptors([...]))`; `withInterceptorsFromDi()` only for third-party class interceptors), animations, i18n (`provideTranslateService` with `MultiTranslateHttpLoader` loading app + library `i18n` folders), organization library tokens (identity, profile, sidebar, footer, app insights), `LocationStrategy`.
- Configuration objects (`sidebarConfig`, `identityConfig`, …) are typed constants built from `environment`. Role strings come from `environment` / `core/constants/roles.constants.ts`, never duplicated literals.
- Feature-scoped providers go in the route's `providers: [...]`, not in `app.config.ts`.

## Routing

- `app.routes.ts` defines the authenticated shell: `{ path: '', component: FullComponent, canActivate: [authGuard], resolve: { userConfig: userConfigResolver }, children: [...] }`, plus `auth-callback` and `unauthorized` outside the shell.
- Each feature: `{ path: '<feature>', canActivate: [<feature>Guard], loadChildren: () => import('./pages/<feature>/<feature>.routing').then(m => m.<FEATURE>_ROUTES) }`.
- Inside `<feature>.routing.ts`: `''` → list, `add/:parentGuid` → create, `edit/:guid` → update. Prefer `loadComponent` for single pages.
- Route params bound to inputs via `withComponentInputBinding()` (`guid = input.required<string>()`) in new code; `ActivatedRoute` is acceptable in existing pages.
- Paths are kebab-case in new routes (`change-password/:userGuid`).
- Guards are functional `CanActivateFn`, wait for user config before checking roles, return `true` or a `UrlTree` (`router.parseUrl('/unauthorized')`) in new code.

## Models

- Request/response interfaces mirror the backend contracts 1:1 (same property names, camelCase). Use `I` prefix.
- Identifiers exposed to the UI are GUIDs (`guid: string`). Internal numeric ids only when the API requires them.
- Paging: `IPaginatedResponse<T> { items: T[]; totalCount: number }` and a request with `page`, `itemsPerPage`, `filter?`, `orderBy?`, `orderByDir?`.
- View-specific shapes (grid rows, form values) are separate interfaces in the page folder; map them in the component or a pure mapper function, not in the API service.

## Service Kinds

| Kind | Naming | State | Pattern |
|---|---|---|---|
| API service | `<Domain>Service` | none (stateless) | `@Injectable({ providedIn: 'root' })`, methods return typed `Observable<T>` |
| State service | `<Name>StateService` | private `signal`, public `asReadonly()` + `computed` | Methods `set…`/`clear…`/`update…`; no HTTP if an API service exists |
| Wrapper / facade | `AuthService`, `ToastService`, `ErrorHandlerService` | minimal | Expose intent-revealing methods (`isSuperAdmin()`, `showToast(message, type)`) over a third-party API |

- All services are `providedIn: 'root'` unless they hold per-feature state; then provide them in the feature route `providers`.
- API version is part of the path constant; when a method accepts a version, it's a typed parameter, not a free string.

## Runtime Environment

- `environment.ts` / `environment.development.ts`: local values.
- `environment.prod.ts`: reads `window.env` (populated by `assets/environment/env.js`) and composes URIs. No literal hosts.
- `env.template.js`: `window.env.<key> = "${ENV_VAR}"`; the container entrypoint runs `envsubst` to produce `env.js`. One image for all environments (dev/stg/prd); differences live in k8s patches.
- Add a new runtime setting in **four places**: `env.template.js`, `environment.ts`, `environment.prod.ts` (+ `environment.development.ts`), and the k8s/pipeline variables.

## Authentication and Authorization

- OIDC via the organization authentication library (`@lantek360/authentication`): `authGuard`, `AuthInterceptor`, `UserConfigService`.
- `AuthService` (app wrapper) exposes role checks (`isSuperAdmin()`, `isAdmin()`, `isSupportTechnician()`, `isMultiTenant()`) and user info. Pages and guards use `AuthService`, not the library directly.
- Sidebar menu items declare the roles that see them; feature guards enforce the same role set.

## Layout, UI Libraries and i18n

- Authenticated pages render inside `share/components/full-layout` (organization layout library header/sidebar/footer).
- UI: Angular Material for controls, dialogs and snackbars; Syncfusion for advanced grids. Wrap repeated library configuration in shared components instead of copying it.
- i18n: `@ngx-translate` with `MultiTranslateHttpLoader` (`./assets/i18n/` and `./assets/@lantek360/layout/i18n/`). Every key exists in every locale file.

## Legacy Exceptions

- `share/wrappers/*.module.ts` exist only to lazy-load third-party module-based routes. Don't add new ones unless a library forces it.
- Existing camelCase folders (`errorHandler/`, `tenantProducts/`) stay until a dedicated refactor; new folders are kebab-case.
