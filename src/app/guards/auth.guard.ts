import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const hasToken = !!sessionStorage.getItem('authToken');

  if (isLoggedIn && hasToken) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
