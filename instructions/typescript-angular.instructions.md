---
description: 'Organization Angular/TypeScript coding standard (single source of truth): naming, files, functions, clean code, strict typing, components, templates, signals, RxJS, forms, error handling, i18n, styles, security, comments and commit format. Applies to Angular micro-frontends and libraries.'
applyTo: '**/src/**/*.ts, **/src/**/*.html, **/src/**/*.scss'
---

# Angular / TypeScript Coding Standard

Companion instructions: `angular-architecture`, `angular-solid-design`, `angular-testing`. Companion skills: `angular-scaffold-app`, `angular-add-feature`, `angular-write-tests`.

Reference implementation: `Licensing.Subscriptions.Frontend`.

## Precedence

- `.editorconfig`, `tsconfig.json`, `angular.json` and lint config in the repository win on formatting.
- When nearby code already follows this standard, match it. When it doesn't, write new code to this standard, and don't refactor untouched code unless asked.
- **Modern target, legacy tolerated.** New code uses the modern APIs below. When editing an existing file that uses a legacy API (`@Input()`, `EventEmitter`, `*ngIf`, constructor DI, class interceptors), keep the file consistent; don't migrate it as a drive-by change.

## Platform

- Use the Angular version the repository targets (currently 22.x) with standalone APIs only. No new `NgModule`.
- TypeScript `strict: true` plus `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. Angular `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`. Never relax them.
- Fix compiler and lint warnings instead of suppressing them. A suppression (`// eslint-disable-next-line`, `@ts-expect-error`) needs a one-line justification. `@ts-ignore` is forbidden.

## Files and Folders

- File and folder names are `kebab-case`. One exported class/component/service per file; the file name matches the type.
- A component lives in its own folder: `<name>.component.ts`, `.html`, `.scss`, `.spec.ts`. No inline templates or styles except for trivial (≤ 5 lines) wrappers.
- Spec file next to the file under test.
- No barrel `index.ts` files inside the app (they hide dependencies and create cycles). Libraries may expose one public API barrel.

| Artifact | File suffix | Example |
|---|---|---|
| Component | `.component.ts` | `list-users.component.ts` |
| Service | `.service.ts` | `users.service.ts` |
| Functional guard | `.guard.ts` | `tenants.guard.ts` |
| Functional interceptor | `.interceptor.ts` | `api-version.interceptor.ts` |
| Resolver | `.resolver.ts` | `user-details.resolver.ts` |
| Pipe / directive | `.pipe.ts` / `.directive.ts` | `role-name.pipe.ts` |
| Interface (model, DTO) | `.interface.ts` | `user-response.interface.ts` |
| Enum | `.enum.ts` | `order-by-dir.enum.ts` |
| Constants | `.constants.ts` | `validation-reg-ex.constants.ts` |
| Feature routes | `.routing.ts` | `users.routing.ts` |
| Spec | `.spec.ts` | `users.service.spec.ts` |

## Naming

Names describe what a thing is and what it is for. A long, descriptive name beats a short, ambiguous one.

| Element | Convention | Example |
|---|---|---|
| Class, component, service, enum, type alias | PascalCase + role suffix | `ListUsersComponent`, `UsersService` |
| Interface | `I` + PascalCase | `IUserResponse`, `IGetPaginatedUsersRequest` |
| Enum members | PascalCase, string values | `OrderByDir.Ascending = 'Ascending'` |
| Methods, properties, variables, signals | camelCase | `loadUsers()`, `selectedTenant` |
| Functional guard / interceptor / resolver | camelCase + role | `tenantsGuard`, `apiErrorInterceptor` |
| Route arrays, injection tokens, module-level constants | UPPER_SNAKE_CASE | `USERS_ROUTES`, `APP_CONFIG` |
| Static readonly class constants | UPPER_SNAKE_CASE | `ValidationRegEx.INTERNATIONAL_PHONE` |
| Component selector | `app-` + kebab-case | `app-users-form` |
| i18n keys | `<feature>.<section>.<key>` camelCase segments | `users.buttons.resendActivationEmail` |
| Observable | `$` suffix | `userConfig$` |
| Boolean | `is` / `has` / `can` / `should` prefix | `isLoading`, `hasPermission` |

Method names: verb + noun in domain language.
- `get…` returns data (Observable for HTTP). `load…` triggers a fetch and stores the result in state. `find…` may return `undefined`. `is…` / `has…` / `can…` return `boolean`.
- Commands use intent verbs: `create`, `update`, `delete`, `assign`, `move`, `unlock`, `toggle`.
- Template event handlers: `on` + event (`onPageChange`, `onTenantSelected`). Navigation: `goTo` + target (`goToCreateUser`).
- No abbreviations except well-known ones (`id`, `guid`, `url`, `uri`, `dto`, `mfa`).
- No private-field underscore prefix in new code (`private readonly usersService`, not `_usersService`). Exception: the writable signal behind a public read-only one may use a `Signal` suffix (`selectedTenantSignal`).

## Types

- Explicit return types on every public method and exported function. Explicit types on public properties when inference isn't obvious.
- No `any`. Use `unknown` and narrow it, a generic, or a proper interface. `HttpClient` calls are always typed: `http.get<IUserResponse>(…)`, never `get<any>`.
- Contracts (requests, responses, view models) are `interface`s with `readonly` properties where the object is not mutated. Optional fields use `?`, not `| undefined`.
- Use string-literal unions for small closed sets local to one type (`'success' | 'error'`), and `enum` (string values) for domain sets shared across files.
- No non-null assertion (`!`) except for `viewChild.required` / definite assignment that the framework guarantees. Prefer optional chaining and `??`.
- Prefer `readonly` arrays (`readonly IUserResponse[]`) for inputs and state you don't mutate.

## Classes and Members

- Dependency injection with `inject()` in field initializers, `private readonly`. No constructor injection in new code.
- Access modifiers: members used only inside the class are `private`; members bound in the template or exercised by tests are public (no modifier in components, explicit `public` in services).
- `readonly` for everything that is not reassigned (fields, signals, form groups).
- Member order: injected dependencies → inputs/outputs/queries → public state (signals, computed) → private state → lifecycle hooks → public methods → template event handlers → private methods. The class reads top-down like a story.
- No magic strings or numbers: use `const`, `static readonly` or a `*.constants.ts` file. Roles, API paths and page sizes are named constants.

## Functions

- Functions do one thing. If the name needs "And", split it.
- Aim for under 20 lines, with 40 as the ceiling. At most 3 parameters; group more into an interface.
- No boolean flag parameters that switch behavior. Create two functions.
- Guard clauses and early returns instead of nested `if`. Max nesting depth 2.
- Pure helpers (no `this`) are `private static` or module-level functions.
- Prefer `const` over `let`. Never `var`. Use immutable updates (`[...items, item]`, `{ ...user, name }`, `signal.update(...)`).
- Prefer array methods (`map`, `filter`, `some`, `find`) over manual loops when they express intent.
- Strict equality only (`===`, `!==`).

## Components

- Standalone (default in current Angular; don't write `standalone: true`).
- `changeDetection: ChangeDetectionStrategy.OnPush` on every new component (explicit, even where the framework default already is OnPush). `Eager`/`Default` only for shells wrapping third-party layouts that require it.
- Inputs and outputs with the signal APIs: `input()`, `input.required()`, `output()`, `model()`. Queries with `viewChild()`, `viewChildren()`, `contentChild()`.
- Local state in `signal()`; derived state in `computed()`. Use `effect()` only to sync with non-Angular APIs (DOM, storage, third-party widgets), never to set other signals.
- Import only what the template uses in `imports: [...]`.
- Lifecycle: data loading in `ngOnInit` (or via `toSignal`/resolver); DOM work in `afterNextRender`/`ngAfterViewInit`; cleanup with `DestroyRef`/`takeUntilDestroyed` instead of `ngOnDestroy` when possible.
- Never mutate an input. Emit an output or update a service.
- Smart (page) components orchestrate services and navigation. Presentational (shared) components only receive inputs and emit outputs; they don't inject API services.

## Templates

- Built-in control flow only: `@if`, `@else`, `@for (item of items(); track item.guid)`, `@empty`, `@switch`, `@defer`. `track` uses a stable identity, never `$index` when items have ids.
- No business logic or method calls with side effects in templates. Expose `computed()` signals or pure pipes. Signal reads (`users()`) are fine.
- Every user-visible text goes through i18n: `{{ 'users.title' | translate }}`. No hard-coded literals.
- `[class.x]` / `[style.x]` bindings instead of `ngClass` / `ngStyle` for single classes.
- Accessibility: buttons are `<button type="button">`, icons-only buttons have `aria-label` (translated), images have `alt`, form controls have labels.
- Use `===` in template expressions.

## Signals and RxJS

- Signals for synchronous UI state; RxJS for async streams (HTTP, events, debounced input). Bridge with `toSignal()` / `toObservable()`.
- Avoid manual `subscribe` in components. Prefer, in order: `toSignal()`, the `async` pipe, then `subscribe` with `takeUntilDestroyed(this.destroyRef)`. Every manual subscription has a cleanup strategy (HTTP observables complete, but still pipe `takeUntilDestroyed` in components so callbacks don't run after destroy).
- Never nest `subscribe` calls. Compose with `switchMap` (latest wins: search, route params), `concatMap` (ordered writes), `mergeMap` (parallel independent), `exhaustMap` (ignore while busy: submit buttons), `forkJoin` (parallel, wait all).
- Reset loading flags in `finalize()`, not in both `next` and `error`.
- Debounce user typing (`debounceTime(300)`, `distinctUntilChanged()`) before calling the backend.
- Services expose read-only state: `private readonly itemsSignal = signal<…>([])` + `readonly items = this.itemsSignal.asReadonly()`. Don't expose `Subject`/`BehaviorSubject` directly; expose `asObservable()`.

## Forms

- Reactive forms with typed controls: `inject(NonNullableFormBuilder)` and `fb.group({ … })`. No template-driven forms for anything beyond a single search box.
- Validators from `Validators` or shared `ValidationRegEx` constants; custom validators are pure `ValidatorFn` functions in `share/validators/`.
- Disable submit while invalid or pending; mark all as touched on invalid submit.
- Map form value → request interface in a private method (`toCreateRequest()`); never send `form.value` blindly.

## HTTP and Error Handling

- Only `core/services` call `HttpClient`. Components never inject `HttpClient`.
- Build URLs from `environment.<api>Uri` + versioned path (`/api/v1.0/<resource>`). Query strings with `HttpParams`, never string concatenation of user input.
- Service write operations pipe `tap(() => toast success)` and `catchError(error => this.errorHandler.handleError(error))`. The `ErrorHandlerService` maps status → translated message, shows the toast and rethrows.
- Components handle errors only to restore UI state; they don't show a second toast. Pipe `catchError(() => EMPTY)` after the service call (before `finalize`) so the already-reported error doesn't surface as unhandled.
- No `console.log`/`console.error` in production code. Use the logging service (`@lantek360/logging`) or `ErrorHandlerService`.

## i18n

- Keys added to **every** locale file under `src/assets/i18n/` in the same change (English text as placeholder for untranslated locales).
- Key hierarchy `<feature>.<section>.<key>`; shared keys under `common.`.
- Use `translate` pipe in templates and `TranslateService.instant()` only for non-template strings (toasts, dialog data).

## Styles

- SCSS, component-scoped. Global styles only in `src/styles.scss` and theme files.
- No `::ng-deep` or `!important` in new code. Theme Material/Syncfusion via their theming APIs or CSS variables.
- Use design tokens/variables for colors and spacing; no hard-coded hex colors in components.

## Comments

- Code explains itself. A comment says **why** (business rule, workaround, external constraint), in one short line.
- No commented-out code, no `TODO` without a work item (`// TODO #12345: …`).
- No JSDoc on obvious members. Use JSDoc only on public APIs of shared libraries.

## Security

- Never use `bypassSecurityTrust*` or bind `[innerHTML]` with data from the API or user input.
- No secrets, tokens or connection strings with credentials in `environment*.ts` or source. Runtime values come from `window.env` (`env.template.js` → `env.js`, substituted at container start).
- Authentication through the organization auth library and interceptor; never store tokens manually in `localStorage`/`sessionStorage`.
- Route guards are UX only. The backend authorizes every request; never rely on hidden buttons or guards for security.
- Validate and encode user input before sending it (`HttpParams`, typed requests). Don't build URLs with unencoded input.
- Don't log PII or tokens.

## Git

- Commit message: `#<work-item>: <type>[(<scope>)][!]: <description>`.
- Types: `feat`, `fix`, `test`, `refactor`, `style`, `docs`, `build`, `ci`, `perf`, `revert`, `chore`.
- One logical change per commit; tests in the same commit as the code they cover.
