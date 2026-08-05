import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const DEFAULT_DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = signal<Toast[]>([]);
  readonly all = this.toasts.asReadonly();
  private nextId = 0;

  success(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(message, 'error', durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(message: string, type: Toast['type'], durationMs: number): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
