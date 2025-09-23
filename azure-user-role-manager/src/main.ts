import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initializeMsal } from './app/msal.config';

// Register service worker for caching
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered successfully:', registration.scope);
    })
    .catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
}

// Optimize app startup by bootstrapping immediately and initializing MSAL in parallel
Promise.all([
  bootstrapApplication(AppComponent, appConfig),
  initializeMsal().catch((err) => {
    console.error('MSAL initialization failed:', err);
    return null; // Continue without MSAL if it fails
  })
]).then(([app]) => {
  console.log('Application bootstrapped successfully');
}).catch((err) => {
  console.error('Application bootstrap failed:', err);
  // Fallback: try to bootstrap without MSAL
  bootstrapApplication(AppComponent, appConfig).catch(fallbackErr => {
    console.error('Fallback bootstrap failed:', fallbackErr);
  });
});
