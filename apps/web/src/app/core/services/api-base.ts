import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: () => environment.apiBase,
});
