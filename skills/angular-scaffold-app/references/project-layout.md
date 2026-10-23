# Project Layout and Skeleton Code

## Root

```
<app-name>/
├── .editorconfig
├── .gitignore                       node_modules, dist, coverage, .angular
├── .npmrc                           organization feed (no tokens)
├── angular.json
├── jest.config.js
├── setup.jest.ts
├── package.json
├── README.md
├── tsconfig.json | tsconfig.app.json | tsconfig.spec.json
├── updateBuildTimeStamp.js          optional: stamps buildTimeStamp in environments
├── k8s/
│   ├── base/                        deployment.yaml, service.yaml, pdb.yaml, kustomization.yaml
│   └── patches/{dev,stg,prd}/       deployment-patch.yaml (env vars), kustomization.yaml
├── Pipelines/
│   ├── <app>-pipeline.yaml
│   ├── create-pr-pipeline.yaml
│   └── Templates/Build/             npm-install, run-tests, run-build-prod, generate-artifacts, docker-images
├── publish/
│   ├── Dockerfile
│   ├── docker-compose.yaml
│   └── configuration/nginx/default.conf
└── src/                             see angular-architecture → Folder Layout
```

## `src/main.ts`

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch(error => console.error(error));
```

`console.error` is acceptable only here: no app services exist if bootstrap fails.

## `src/app/app.config.ts`

```ts
import { HttpBackend, HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AuthInterceptor, IDENTITY_CONFIG_TOKEN, IdentityConfig, PROFILE_CONFIG_TOKEN } from '@lantek360/authentication';
import { FOOTER_CONFIG_TOKEN, FooterConfig, ProfileConfig, SIDEBAR_CONFIG_TOKEN, SidebarConfig, menuType } from '@lantek360/layout';
import { APP_INSIGHT_CONFIG_TOKEN, AppInsightConfig } from '@lantek360/logging';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MultiTranslateHttpLoader } from 'ngx-translate-multi-http-loader';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export function httpLoaderFactory(httpBackend: HttpBackend): MultiTranslateHttpLoader {
  return new MultiTranslateHttpLoader(httpBackend, [
    { prefix: './assets/i18n/', suffix: '.json' },
    { prefix: './assets/@lantek360/layout/i18n/', suffix: '.json' },
  ]);
}

const profileConfig: ProfileConfig = { /* from environment: authorityUri, clientId, scope, redirect URIs, appRoles … */ };
const identityConfig: IdentityConfig = { /* identityUri + user config endpoints from environment */ };
const sidebarConfig: SidebarConfig = {
  menuItems: [
    // { state: '<feature>', name: '<feature>.title', type: menuType.link, icon: '<icon>', roles: [environment.adminRole] },
  ],
};
const appInsightConfig: AppInsightConfig = {
  enableAppInsight: environment.enableAppInsight,
  appInsightServiceName: environment.appRoleName,
  config: { connectionString: environment.connectionString, enableAutoRouteTracking: true },
};
const footerConfig: FooterConfig = {};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([]), withInterceptorsFromDi()),
    // The organization auth library ships a class-based interceptor.
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideAnimationsAsync(),
    provideTranslateService({
      loader: { provide: TranslateLoader, useFactory: httpLoaderFactory, deps: [HttpBackend] },
      fallbackLang: 'en-US',
    }),
    { provide: PROFILE_CONFIG_TOKEN, useValue: profileConfig },
    { provide: IDENTITY_CONFIG_TOKEN, useValue: identityConfig },
    { provide: SIDEBAR_CONFIG_TOKEN, useValue: sidebarConfig },
    { provide: FOOTER_CONFIG_TOKEN, useValue: footerConfig },
    { provide: APP_INSIGHT_CONFIG_TOKEN, useValue: appInsightConfig },
  ],
};
```

Match the exact config property names to the installed organization library versions (copy from the reference repo's `app.config.ts`).

## `src/app/app.routes.ts`

```ts
import { Routes } from '@angular/router';
import { authGuard } from '@lantek360/authentication';
import { AuthCallbackComponent, userConfigResolver } from '@lantek360/layout';
import { FullComponent } from './share/components/full-layout/full.component';

export const routes: Routes = [
  {
    path: '',
    component: FullComponent,
    canActivate: [authGuard],
    resolve: { userConfig: userConfigResolver },
    children: [
      // { path: '', redirectTo: '<default-feature>', pathMatch: 'full' },
      { path: 'profile', loadChildren: () => import('@lantek360/layout').then(m => m.ProfileModule) },
      // Feature routes are added by the angular-add-feature skill.
    ],
  },
  { path: 'auth-callback', component: AuthCallbackComponent },
  {
    path: 'unauthorized',
    resolve: { userConfig: userConfigResolver },
    loadChildren: () => import('./share/wrappers/unauthorized-wrapper.module').then(m => m.UnauthorizedModuleWrapper),
  },
  { path: '**', redirectTo: '' },
];
```

## `core/constants/roles.constants.ts`

```ts
import { environment } from '../../../environments/environment';

export const ROLES = {
  SUPER_ADMIN: environment.superAdminRole,
  ADMIN: environment.adminRole,
} as const;
```

## `core/services/auth/auth.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserConfig, UserService } from '@lantek360/authentication';
import { ROLES } from '../../constants/roles.constants';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userService = inject(UserService);
  private readonly userConfig = toSignal(this.userService.userConfig$, { initialValue: new UserConfig() });

  public isSuperAdmin(): boolean {
    return this.hasRole(ROLES.SUPER_ADMIN);
  }

  public isAdmin(): boolean {
    return this.hasRole(ROLES.ADMIN);
  }

  public getEmail(): string {
    return this.userConfig().email?.toString() ?? '';
  }

  private hasRole(roleKey: string): boolean {
    return this.userConfig().roles?.some(role => role.key === roleKey) ?? false;
  }
}
```

## `core/services/toast/toast.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { CustomToastComponent } from '../../../share/components/toast/toast-custom.component';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

const TOAST_DURATION_MS = 3000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  public showToast(messageKey: string, type: ToastType): void {
    this.snackBar.openFromComponent(CustomToastComponent, {
      duration: TOAST_DURATION_MS,
      data: { message: this.translate.instant(messageKey), type },
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
```

## `core/services/error-handler/error-handler.service.ts`

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ToastService, ToastType } from '../toast/toast.service';

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private readonly toastService = inject(ToastService);

  // Arrow property so it can be passed directly to catchError without losing `this`.
  public readonly handleError = (error: HttpErrorResponse): Observable<never> => {
    const { messageKey, type } = ErrorHandlerService.toToast(error);
    this.toastService.showToast(messageKey, type);
    return throwError(() => new Error(messageKey));
  };

  private static toToast(error: HttpErrorResponse): { messageKey: string; type: ToastType } {
    if (error.status === 0) {
      return { messageKey: 'common.errors.noConnection', type: 'error' };
    }
    if (error.status >= 400 && error.status < 500) {
      return { messageKey: error.error?.message ?? 'common.errors.badRequest', type: 'warning' };
    }
    return { messageKey: 'common.errors.server', type: 'error' };
  }
}
```

## `share/components/full-layout/full.component.ts`

Authenticated shell using the organization layout library (`LayoutModule`, `ProfileModule`), Material toolbar and `<router-outlet>`. Copy from the reference repo; use `inject(DestroyRef).onDestroy(...)` to remove the media-query listener.

## `src/environments/environment.prod.ts`

```ts
const windowEnv = ((window as unknown as Record<string, unknown>)['env'] ?? {}) as Record<string, string>;

export const environment = {
  production: true,
  assetsApiUri: `https://${windowEnv['apiUri']}`,
  authorityUri: `https://${windowEnv['authUri']}`,
  redirectUri: `https://${windowEnv['frontUri']}/auth-callback`,
  scope: windowEnv['scope'],
  connectionString: windowEnv['connectionString'],
  appRoleName: windowEnv['appRoleName'],
  enableAppInsight: true,
  clientId: '<client-guid>',
  superAdminRole: 'all_<client-guid>_superAdmin',
  adminRole: 'all_<client-guid>_admin',
};
```

`environment.ts` and `environment.development.ts` have the same keys with local values. Keep the three files in sync.

## `src/index.html`

Load runtime config before the bundle:

```html
<script src="assets/environment/env.js"></script>
```

## `publish/Dockerfile`

```dockerfile
FROM nginxinc/nginx-unprivileged:<pinned-version>

USER 10001:10001
ARG sources="."

WORKDIR /usr/src/app

COPY ./configuration/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY $sources /usr/share/nginx/html

EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/environment/env.js && exec nginx -g 'daemon off;'"]
```

## Skeleton Specs

Create specs for every skeleton service, guard and the shell, so the coverage threshold passes from the first commit:
- `auth.service.spec.ts`: each role check true/false, `getEmail` fallback.
- `toast.service.spec.ts`: `openFromComponent` called with translated message and type.
- `error-handler.service.spec.ts`: status 0, 4xx with/without message, 5xx.
- `full.component.spec.ts`: template override, listener removed on destroy.
- `app.component.spec.ts`: creates.
