import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { RegRenKeywordDTO } from '../models/reg-ren-keyword-dto';

@Injectable({
  providedIn: 'root'
})
export class RegRenKeywordService {

  constructor(private http: HttpClient) { }

  private readonly apiUrlProcess: string = environment.apiUrlAuth;

  getKeywords(): Observable<RegRenKeywordDTO[]> {
    return this.http.get<Response>(`${this.apiUrlProcess}/api/keywords/list`).pipe(
      map(res => this.extractData(res)),
      catchError(err => this.handleError(err))
    );
  }

  private extractData(res: Response): RegRenKeywordDTO[] {
    if (res.error === 0 && res.resultado) {
      return res.resultado as RegRenKeywordDTO[];
    }
    
    throw new Error(res.mensaje || 'Error loading keywords from server');
  }

  private handleError(error: any): Observable<never> {
    console.error('RegRenKeywordService Error:', error);
    return throwError(() => new Error(error.message || 'Server connection failed'));
  }
}
