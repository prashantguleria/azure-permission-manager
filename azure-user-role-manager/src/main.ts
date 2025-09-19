import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initializeMsal } from './app/msal.config';

// Initialize MSAL before bootstrapping the application
initializeMsal().then(() => {
  return bootstrapApplication(AppComponent, appConfig);
}).catch((err) => {
  console.error('MSAL initialization failed:', err);
  // Still try to bootstrap the app even if MSAL fails
  return bootstrapApplication(AppComponent, appConfig);
}).catch((err) => console.error('Application bootstrap failed:', err));
