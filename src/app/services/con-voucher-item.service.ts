import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Response } from '../models/response';
import { WrapperRequestVoucherItem } from '../models/wrappers/wrapper-request-voucher-item';

@Injectable({
    providedIn: 'root'
})
export class ConVoucherService {

    constructor(private http: HttpClient) { }

    token = sessionStorage.getItem('authToken');
    private apiUrlProcess: string = environment.apiUrlProcess;

    getAsiento(wrapper: WrapperRequestVoucherItem): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        });
        return this.http.get<Response>(
            `${this.apiUrlProcess}con-voucher/listar/${wrapper.codEmpresa}/${wrapper.anoPeriodo}/${wrapper.codPeriodo}/${wrapper.codTipoComprobante}/${wrapper.numFile}/${wrapper.numVoucher}`,
            {
                headers,
                responseType: 'json'
            }
        );
    }
}