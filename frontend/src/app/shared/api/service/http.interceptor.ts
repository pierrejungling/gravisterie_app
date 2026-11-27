import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environment/environment';
import { TokenService } from './token.service';
import { AuthSessionService } from './auth-session.service';
import { ClientIdService } from './client-id.service';
import {
  AddTokenHeaderFn,
  HttpInterceptorHandlerFn,
  HttpInterceptorCommonErrorHandlerFn
} from '../type';

const baseURL: string = environment.apiURL;
const publicRoute: string[] = [
  `${baseURL}`,
  `${baseURL}account/signin`,
  `${baseURL}account/refresh`,
  // Santé du serveur : demandée par les voyants de la page de connexion, donc sans être connecté.
  `${baseURL}health`
];

const setTokenInHeader: AddTokenHeaderFn = (req: HttpRequest<any>, token: string, clientId?: string): HttpRequest<any> => {
  let headers = req.headers.set('Authorization', `Bearer ${token}`);
  if (clientId) {
    headers = headers.set('X-Client-Id', clientId);
  }
  return req.clone({ headers });
};

const handleError: HttpInterceptorHandlerFn = (
  err: HttpErrorResponse,
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  tokenService: TokenService,
  authSession: AuthSessionService,
  clientId: string
): Observable<any> => {
  if (err.status === 401 || err.status === 403) {
    if (tokenService.token().isEmpty) {
      authSession.redirectToSignIn(undefined, `${err.status} sans session`);
      return EMPTY;
    }
    return authSession.refreshAccessToken().pipe(
      // Déconnexion uniquement si le REFRESH lui-même est refusé (401/403) ou impossible faute de refresh token.
      // Réseau coupé ou serveur en redéploiement (0, 502, 503...) : on garde la session et on remonte l'erreur d'origine.
      catchError((refreshErr: unknown) => {
        const status = refreshErr instanceof HttpErrorResponse ? refreshErr.status : -1;
        if (status === 401 || status === 403 || status === -1) {
          authSession.redirectToSignIn(undefined, `refresh refusé (${status})`);
          return EMPTY;
        }
        return handleCommonError(err);
      }),
      // Une erreur de la requête rejouée avec le nouveau token ne déconnecte jamais : elle remonte telle quelle.
      switchMap((newToken) =>
        next(setTokenInHeader(req, newToken.token, clientId)).pipe(
          catchError((retryErr: HttpErrorResponse) => handleCommonError(retryErr))
        )
      )
    );
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
  const clientId = inject(ClientIdService).clientId;
  const router = inject(Router);

  if (!tokenService.token().isEmpty) {
    return next(setTokenInHeader(req, tokenService.token().token, clientId)).pipe(
      catchError((err: HttpErrorResponse) => handleError(err, req, next, tokenService, authSession, clientId))
    );
  }

  authSession.redirectToSignIn(router.url, 'aucun token au démarrage de la requête');
  return EMPTY;
};
