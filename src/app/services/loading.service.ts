import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  private loadingCount = 0;

  show(): void {
    this.loadingCount += 1;
    if (this.loadingCount === 1) {
      this.loadingSubject.next(true);
    }
  }

  hide(): void {
    if (this.loadingCount > 0) {
      this.loadingCount -= 1;
    }
    if (this.loadingCount === 0) {
      this.loadingSubject.next(false);
    }
  }
}
