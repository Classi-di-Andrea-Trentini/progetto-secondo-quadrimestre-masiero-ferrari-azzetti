import { ApplicationConfig, isDevMode, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';

// Il sito e' stato tradotto interamente in inglese: `LOCALE_ID` deve seguire,
// altrimenti il pipe `date` con token testuali (`MMMM`, `longDate`, ...)
// continua a formattare i mesi in italiano ("settembre 2026") su una pagina
// tutta in inglese, anche se nessuna stringa italiana e' rimasta nel codice.
// `en-US` e' gia' il locale con cui Angular viene distribuito di default, quindi
// non serve registrare dati locale aggiuntivi con `registerLocaleData`.
// `formatPrice` (services/format-price.ts) non dipende da questo provider — usa
// un `Intl.NumberFormat('en', ...)` proprio, indipendente da `LOCALE_ID` — quindi
// il formato prezzo ("€120.00") resta invariato.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'en-US' },
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
