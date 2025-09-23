import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideNzIcons } from './icons-provider';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';

// MSAL imports
import { MsalModule, MsalService, MsalGuard, MsalInterceptor, MsalBroadcastService, MsalRedirectComponent } from '@azure/msal-angular';
import { InteractionType } from '@azure/msal-browser';
import { msalInstance } from './msal.config';

registerLocaleData(en);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideClientHydration(),
    provideNzIcons(),
    provideNzI18n(en_US),
    importProvidersFrom(FormsModule),
    NzModalService,
    NzMessageService,
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(MsalModule.forRoot(msalInstance, {
      interactionType: InteractionType.Redirect,
      authRequest: {
        scopes: ['user.read', 'Directory.Read.All', 'RoleManagement.ReadWrite.Directory', 'Organization.Read.All']
      }
    }, {
      interactionType: InteractionType.Redirect,
      protectedResourceMap: new Map([
        ['https://graph.microsoft.com/v1.0/me', ['user.read']],
        ['https://graph.microsoft.com/v1.0/me/memberOf', ['user.read', 'Directory.Read.All']],
        ['https://graph.microsoft.com/v1.0/users', ['Directory.Read.All']],
        ['https://graph.microsoft.com/v1.0/organization', ['Organization.Read.All']],
        ['https://graph.microsoft.com/v1.0/roleManagement', ['RoleManagement.ReadWrite.Directory']],
        ['https://graph.microsoft.com/v1.0/auditLogs', ['AuditLog.Read.All']],
        ['https://management.azure.com/', ['https://management.azure.com/.default']]
      ])
    })),
    MsalService,
    MsalGuard,
    MsalBroadcastService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true
    }
  ]
};
