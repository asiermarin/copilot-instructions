---
name: angular-add-feature
description: 'Add a feature end-to-end to an Angular micro-frontend following the organization clean architecture: request/response models and enums, API service, optional signal state service, functional guard, lazy feature routing, list/add/update page components (OnPush, signals, reactive forms), shared presentational/dialog components, sidebar menu entry, i18n keys in every locale and Jest tests. USE FOR: new page, new screen, new CRUD feature, new backend resource in the UI, new dialog, new form, extend a feature with a new operation. DO NOT USE FOR: creating a new Angular app (use angular-scaffold-app), writing tests only (use angular-write-tests).'
argument-hint: 'Describe the feature: resource name, operations (list/create/update/delete/custom), API endpoints and version, roles allowed, shared state needed'
---

# Add an Angular Feature

Follow the `typescript-angular`, `angular-architecture` and `angular-solid-design` instructions. Copy-paste templates are in [templates.md](./references/templates.md); replace `Asset`/`asset`/`assets`/`ASSETS` with the real names.

## 1. Understand Before Coding

1. Find the closest existing feature (in the reference repo: `pages/users`, `pages/tenants`) and its service, guard and specs. Reuse its shape.
2. Decide and write down:
   - **Operations:** list (paged? filtered? sorted?), create, update, delete, custom actions.
   - **Backend contract:** endpoints, HTTP verbs, API version, request/response fields.
   - **Access:** which roles see the menu entry and can enter the route; which roles see each action.
   - **State:** page-local (signals in the page) or shared across pages (state service in `core/services/shared`).
   - **Reuse:** form shared by add/update? confirm dialog? tenant/plant filter?
3. If any of these are unknown, ask before writing code.

## 2. Implement Inside-Out

| # | Step | Location | Template |
|---|---|---|---|
| 1 | Request/response interfaces, enums | `core/models/<domain>/request|response/`, `core/models/enums/` | [Models](./references/templates.md#models) |
| 2 | API service (typed, `catchError`, success toast) | `core/services/<domain>/<domain>.service.ts` | [API service](./references/templates.md#api-service) |
| 3 | State service (only if shared state) | `core/services/shared/<name>-state.service.ts` | [State service](./references/templates.md#state-service) |
| 4 | Role constants / guard | `core/guards/<feature>.guard.ts` | [Guard](./references/templates.md#guard) |
| 5 | Shared form / presentational / dialog components | `share/components/forms/<domain>-form/`, `share/components/dialogs/` | [Form component](./references/templates.md#shared-form-component) |
| 6 | Page components: list, add, update | `pages/<feature>/list-<feature>/`, `add-<feature>/`, `update-<feature>/` | [List page](./references/templates.md#list-page), [Add/update page](./references/templates.md#addupdate-page) |
| 7 | Feature routes | `pages/<feature>/<feature>.routing.ts` | [Routing](./references/templates.md#routing) |
| 8 | Register lazy route + guard | `app.routes.ts` | [Routing](./references/templates.md#routing) |
| 9 | Sidebar menu entry with roles | `app.config.ts` (`sidebarConfig.menuItems`) | [Menu entry](./references/templates.md#menu-entry) |
| 10 | i18n keys in **every** locale | `src/assets/i18n/*.json` | [i18n](./references/templates.md#i18n) |
| 11 | Runtime settings (if a new API base URI) | `env.template.js`, `environment*.ts`, k8s patches | `angular-architecture` → Runtime Environment |

Rules while implementing:
- New components: `ChangeDetectionStrategy.OnPush`, `input()`/`output()`, `inject()`, signals, `@if`/`@for`, no `any`.
- Subscriptions in components: `takeUntilDestroyed(this.destroyRef)` or `toSignal`. Loading flags reset in `finalize`.
- Only the API service calls `HttpClient`. Only pages navigate and open dialogs.
- Role checks through `AuthService`, never literal role strings.

## 3. Tests

Use the `angular-write-tests` skill. Minimum for a CRUD feature:
- API service spec: URL, method, params/body, success toast, error delegation per method.
- Guard spec: allow per role, deny + redirect.
- List page spec: initial load, paging, filter, each action (with dialog result `true`/`false`), navigation.
- Add/update page spec: form validity, mapped request sent, navigation after success, UI restored on error.
- Shared form/dialog specs: inputs → form, emitted outputs / `close` result.

## 4. Verify

```powershell
npm run build
npm test
```

- [ ] No dependency-rule violations (pages don't import other pages; share doesn't inject API services or `Router`; components don't inject `HttpClient`).
- [ ] No `any`, no `console.*`, no hard-coded user-visible text or role strings.
- [ ] Every new i18n key exists in every locale file.
- [ ] Route is lazy and guarded; the menu entry roles match the guard.
- [ ] Coverage thresholds pass; tests follow `should … when …` + AAA comments.
- [ ] Commit: `#<work-item>: feat(<feature>): <description>`.
