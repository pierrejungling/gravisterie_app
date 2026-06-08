import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthSessionService, TokenService } from '@api';

export type AddTokenHeaderFn = (req: HttpRequest<any>, token: string) => HttpRequest<any>;

export type HttpInterceptorHandlerFn = (
  error: HttpErrorResponse,
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  tokenService: TokenService,
  authSession: AuthSessionService
) => Observable<any>;

export type HttpInterceptorCommonErrorHandlerFn = (error: HttpErrorResponse) => Observable<any>;
