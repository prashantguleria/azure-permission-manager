import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'azure-rm-theme';

  readonly mode = signal<ThemeMode>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const current = this.mode();
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.classList.toggle('dark-mode', current === 'dark');
        localStorage.setItem(this.storageKey, current);
      }
    });
  }

  toggle(): void {
    this.mode.update(m => m === 'light' ? 'dark' : 'light');
  }

  private getInitialTheme(): ThemeMode {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.storageKey) as ThemeMode | null;
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
}
