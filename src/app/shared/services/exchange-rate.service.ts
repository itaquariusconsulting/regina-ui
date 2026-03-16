import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MaeTipoCambio } from '../../models/mae-tipo-cambio';

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private exchangeRateSource = new BehaviorSubject<MaeTipoCambio | null>(this.getInitialRate());
  exchangeRate$ = this.exchangeRateSource.asObservable();

  private getInitialRate(): MaeTipoCambio | null {
    const data = sessionStorage.getItem('tipocambio');
    return data ? JSON.parse(data) : null;
  }

  updateExchangeRate(rate: MaeTipoCambio) {
    sessionStorage.setItem('tipocambio', JSON.stringify(rate));
    this.exchangeRateSource.next(rate); 
  }

  clearRate() {
    sessionStorage.removeItem('tipocambio');
    this.exchangeRateSource.next(null);
  }
}