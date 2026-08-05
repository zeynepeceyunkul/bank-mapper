import { Injectable, signal } from '@angular/core';

interface ConfirmRequest {
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly request = signal<ConfirmRequest | null>(null);
  readonly current = this.request.asReadonly();

  // Native confirm() tarayicinin kendi (uygulamayla tutarsiz gorunen) sistem
  // penceresini gosteriyordu. Bunun yerine Promise donduren bu servis +
  // app-confirm-dialog (uygulama kok bilesenine mount edilmis) kullaniliyor -
  // cagiran taraf `await confirmService.confirm(...)` ile senkron confirm()
  // kullanimiyla ayni sekilde bekleyebiliyor.
  confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.request.set({ message, resolve });
    });
  }

  respond(value: boolean): void {
    this.request()?.resolve(value);
    this.request.set(null);
  }
}
