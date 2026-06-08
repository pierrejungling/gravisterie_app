import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environment/environment';
import { TokenService } from './token.service';
import { AuthSessionService } from './auth-session.service';
import {
  AddTokenHeaderFn,
  HttpInterceptorHandlerFn,
  HttpInterceptorCommonErrorHandlerFn
} from '../type';

const baseURL: string = environment.apiURL;
const publicRoute: string[] = [
  `${baseURL}`,
  `${baseURL}account/signin`,
  `${baseURL}account/admin-signin`,
  `${baseURL}account/signup`,
  `${baseURL}account/refresh`
];

const setTokenInHeader: AddTokenHeaderFn = (req: HttpRequest<any>, token: string): HttpRequest<any> => {
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });
};

const handleError: HttpInterceptorHandlerFn = (
  err: HttpErrorResponse,
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  tokenService: TokenService,
  authSession: AuthSessionService
): Observable<any> => {
  if (err.status === 401 || err.status === 403) {
    if (!tokenService.token().isEmpty) {
      return authSession.refreshAccessToken().pipe(
        switchMap((newToken) =>
          next(setTokenInHeader(req, newToken.token)).pipe(
            catchError((retryErr: HttpErrorResponse) => handleCommonError(retryErr))
          )
        ),
        catchError(() => {
          authSession.redirectToSignIn();
          return EMPTY;
        })
      );
    }
    authSession.redirectToSignIn();
    return EMPTY;
  }
  return handleCommonError(err);
};

const handleCommonError: HttpInterceptorCommonErrorHandlerFn = (err: HttpErrorResponse): Observable<any> => {
  throw err;
};

export const HttpInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  if (!req.url.startsWith(baseURL) || publicRoute.includes(req.url)) {
    return next(req);
  }

  const tokenService = inject(TokenService);
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  if (!tokenService.token().isEmpty) {
    return next(setTokenInHeader(req, tokenService.token().token)).pipe(
      catchError((err: HttpErrorResponse) => handleError(err, req, next, tokenService, authSession))
    );
  }

  authSession.redirectToSignIn(router.url);
  return EMPTY;
};
