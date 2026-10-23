// Copy to src/__mocks__/@ngx-translate/core.ts. Mapped by jest.config.js moduleNameMapper: translations return the key.
import { Injectable, InjectionToken, NgModule, Pipe, PipeTransform, Provider } from '@angular/core';
import { of } from 'rxjs';

export const TRANSLATE_SERVICE_CONFIG = new InjectionToken<unknown>('TRANSLATE_SERVICE_CONFIG');
export const TranslateLoader = new InjectionToken<unknown>('TranslateLoader');

@Pipe({ name: 'translate' })
export class TranslatePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return value;
  }
}

@Injectable()
export class TranslateService {
  currentLang = 'en';
  defaultLang = 'en';
  onLangChange = of({ lang: this.currentLang });
  onDefaultLangChange = of({ lang: this.defaultLang });
  onTranslationChange = of({});

  use(lang: string) {
    this.currentLang = lang;
    return of(lang);
  }

  setDefaultLang(lang: string): void {
    this.defaultLang = lang;
  }

  get(key: string | string[]) {
    return of(key);
  }

  instant(key: string | string[]): string | string[] {
    return key;
  }
}

@NgModule({
  imports: [TranslatePipe],
  exports: [TranslatePipe],
  providers: [TranslateService],
})
export class TranslateModule {
  static forRoot(): { ngModule: typeof TranslateModule; providers: Provider[] } {
    return { ngModule: TranslateModule, providers: [TranslateService] };
  }
}

export function provideTranslateService(_config?: unknown): Provider[] {
  return [{ provide: TranslateService, useClass: TranslateService }];
}

export function provideChildTranslateService(): Provider[] {
  return provideTranslateService();
}

export function provideMissingTranslationHandler(): Provider[] {
  return [];
}

export function provideTranslateCompiler(): Provider[] {
  return [];
}

export function provideTranslateLoader(): Provider[] {
  return [];
}

export function provideTranslateParser(): Provider[] {
  return [];
}
