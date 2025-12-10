import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environment/environment';
import { ApiResponse } from '../model';
import { Payload } from '@shared';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseURL: string = environment.apiURL;
  private readonly paramIsMissingErrorCode: number = environment.PARAM_IS_MISSING;
  private readonly http: HttpClient = inject(HttpClient);

  get(partURL: string): Observable<ApiResponse> {
    return this.handle(this.http.get(`${this.baseURL}${partURL}`));
  }

  post(partURL: string, payload: Payload): Observable<ApiResponse> {
    return this.handle(this.http.post(`${this.baseURL}${partURL}`, payload));
  }

  put(partURL: string, payload: Payload): Observable<ApiResponse> {
    return this.handle(this.http.put(`${this.baseURL}${partURL}`, payload));
  }

  delete(partURL: string): Observable<ApiResponse> {
    return this.handle(this.http.delete(`${this.baseURL}${partURL}`));
  }

  private handle(obs: Observable<any>): Observable<ApiResponse> {
    return obs.pipe(
      map((response: Object) => this.successHandler(response)),
      catchError((error: HttpErrorResponse) => of(this.errorHandler(error)))
    );
  }

  private errorHandler(httpError: HttpErrorResponse): ApiResponse {
    return {
      ...httpError.error,
      paramError: httpError.status === this.paramIsMissingErrorCode
    } as ApiResponse;
  }

  private successHandler(response: Object): ApiResponse {
    return {
      ...response as ApiResponse,
      paramError: false
    } as ApiResponse;
  }
}
