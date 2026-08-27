import { ApplicationConfig, isDevMode, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';

// Senza questo il pipe `date` formatta in inglese ("March 12, 1998") dentro un
// sito per il resto tutto in italiano: il locale predefinito di Angular e'
// `en-US` a prescindere dal `lang` dell'HTML.
registerLocaleData(localeIt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'it-IT' },
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    // Il service worker e' quello che rende il sito installabile (senza, il browser
    // non offre "Aggiungi a schermata Home") e quello che lo fa aprire anche
    // offline. Solo in produzione: `ng serve` non lo costruisce, e tenerlo acceso
    // in sviluppo servirebbe la versione vecchia a ogni salvataggio.
    // `registerWhenStable` aspetta che l'app abbia finito di partire: registrarlo
    // subito ruberebbe banda al primo caricamento, che e' quello che conta.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
