import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Pet } from '../models/api.model';

export interface CreatePetInput {
  name: string;
  kind?: string;
  breed?: string;
  status?: Pet['status'];
}

@Injectable({ providedIn: 'root' })
export class PetsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  list(): Observable<Pet[]> {
    return this.http.get<Pet[]>(`${this.base}/pets`);
  }

  create(input: CreatePetInput): Observable<Pet> {
    return this.http.post<Pet>(`${this.base}/pets`, input);
  }

  hide(id: string): Observable<Pet> {
    return this.http.delete<Pet>(`${this.base}/pets/${id}`);
  }
}
