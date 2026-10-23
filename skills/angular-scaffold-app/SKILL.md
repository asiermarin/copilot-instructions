---
name: angular-scaffold-app
description: 'Scaffold a new Angular micro-frontend following the organization standard: standalone Angular app with strict TypeScript, SCSS, core/pages/share layout, app.config.ts composition root (router, HTTP, interceptors, i18n, OIDC auth, layout, logging), authenticated shell routes, error/toast/auth wrapper services, runtime environment (env.template.js + envsubst), Jest instead of Karma with coverage thresholds and Sonar reporter, angular-eslint, nginx Dockerfile, k8s base/patches and Azure DevOps pipeline templates. USE FOR: new frontend, new micro-frontend, new Angular app, bootstrap Angular project, migrate Karma to Jest. DO NOT USE FOR: adding a feature to an existing app (use angular-add-feature).'
argument-hint: 'App name (e.g. Licensing.Assets.Frontend), backend API base URI variable(s), application roles, OIDC client id'
---

# Scaffold an Angular Micro-frontend

Follow the `typescript-angular`, `angular-architecture` and `angular-testing` instructions. The folder skeleton and skeleton code are in [project-layout.md](./references/project-layout.md). Config files to copy are in [assets/](./assets/).

## 1. Inputs

Ask for anything missing:

| Input | Example |
|---|---|
| Repository / app name | `Licensing.Assets.Frontend` |
| Component prefix | `app` |
| Backend API base URI env var(s) | `ASSETS_API_URI` → `assetsApiUri` |
| OIDC client id and scope | `<guid>`, `openid profile api1` |
| Application roles | `superAdmin`, `admin`, … |
| Supported locales | `en-US`, `es-ES`, … (copy the list from the reference repo by default) |

## 2. Procedure

1. **Create the app** (latest Angular major used by the organization):

   ```powershell
   npx @angular/cli@latest new <app-name> --style=scss --routing --ssr=false --skip-tests=false --prefix=app
   ```

2. **Strict TypeScript.** Make sure `tsconfig.json` has `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch` and `angularCompilerOptions` `strictInjectionParameters`, `strictInputAccessModifiers`, `strictTemplates` set to `true`.
3. **Replace Karma with Jest:**
   - Remove `karma*`, `jasmine*`, `@types/jasmine` packages, `karma.conf.js` and the `test` target in `angular.json`.
   - `npm i -D jest jest-preset-angular jest-environment-jsdom jest-sonar @types/jest ts-jest`
   - Copy [jest.config.js](./assets/jest.config.js), [setup.jest.ts](./assets/setup.jest.ts) and [tsconfig.spec.json](./assets/tsconfig.spec.json) to the repo root.
   - Copy [ngx-translate-core.mock.ts](./assets/ngx-translate-core.mock.ts) to `src/__mocks__/@ngx-translate/core.ts`.
   - Scripts: `"test": "jest --coverage"`, `"test:watch": "jest --watch"`.
4. **Lint and formatting:** `npx ng add @angular-eslint/schematics`; copy [.editorconfig](./assets/.editorconfig). Add `"lint": "ng lint"`.
5. **Dependencies:** Angular Material + CDK, `@ngx-translate/core`, `ngx-translate-multi-http-loader`, organization libraries (`@lantek360/authentication`, `@lantek360/layout`, `@lantek360/logging`), Syncfusion only if grids are needed. Configure the organization npm feed in `.npmrc` (no tokens committed).
6. **Folder skeleton and skeleton code** from [project-layout.md](./references/project-layout.md):
   - `core/` (constants, guards, interceptors, models, services: auth, error-handler, toast, shared)
   - `pages/`
   - `share/` (components: full-layout, toast, dialogs/confirm-dialog)
   - `app.config.ts`, `app.routes.ts`, `main.ts`
7. **Runtime environment:**
   - Copy [env.template.js](./assets/env.template.js) to `src/assets/` and create `src/assets/environment/env.js` with empty values.
   - Create `environment.ts`, `environment.development.ts` and `environment.prod.ts` (`prod` reads `window.env`).
   - Load `assets/environment/env.js` in `index.html` before the app bundle.
   - Add `fileReplacements` in `angular.json`.
8. **i18n:** `src/assets/i18n/<locale>.json` for every locale with `common.*` keys. Add the organization layout i18n assets to `angular.json` `assets`.
9. **Container:** `publish/Dockerfile` (nginx-unprivileged, `envsubst` on `env.template.js` at start), `publish/configuration/nginx/default.conf` (SPA fallback to `index.html`, cache headers, security headers), `publish/docker-compose.yaml` for local runs.
10. **Kubernetes:** `k8s/base` (deployment, service, pdb, kustomization) and `k8s/patches/{dev,stg,prd}` with the env vars from step 7. Copy from the reference repo and rename.
11. **Pipelines:** `Pipelines/<app>-pipeline.yaml` + `Pipelines/Templates/Build/{npm-install,run-tests,run-build-prod,generate-artifacts,docker-images}.yaml` and the GitOps templates, copied from the reference repo. Follow `azure-devops-pipelines` instructions.
12. **README** with run/test/build commands and the env var table (use the `create-readme` skill).

## 3. Verify

```powershell
npm run lint
npm run build
npm test
```

- [ ] App boots (`npm start`) and redirects to login; after login the shell renders.
- [ ] `npm test` passes with coverage thresholds (skeleton services and guards have specs).
- [ ] No Karma/Jasmine left; no `NgModule` except third-party wrappers.
- [ ] No secrets in `environment*.ts`, `env.js` or pipelines; runtime values come from env vars.
- [ ] `docker build` succeeds and the container serves the app with substituted `env.js`.
- [ ] First commit: `#<work-item>: build: scaffold <app-name>`.
