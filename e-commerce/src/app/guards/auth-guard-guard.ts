import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { of } from 'rxjs';

export const authGuardGuard: CanActivateFn = () => {
  // In SSR non ci sono cookie: lascia passare il server e rimanda il controllo al client
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return of(true);

  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      if (auth.isAuthenticated()) return true;
      return router.createUrlTree(['/login']);
    }),
  );
};
