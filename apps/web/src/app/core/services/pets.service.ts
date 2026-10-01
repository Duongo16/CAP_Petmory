import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Carer, Pet } from '../models/api.model';

export interface CreatePetInput {
  name: string;
  kind?: Pet['kind'];
  breed?: string;
  gender?: Pet['gender'];
  birthDate?: string;
  status?: Pet['status'];
  passedAwayDate?: string;
  tagline?: string;
  adoptionDate?: string;
  microchip?: string;
  neutered?: boolean;
  trait?: string[];
  carer?: Carer[];
}

@Injectable({ providedIn: 'root' })
export class PetsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  list(): Observable<Pet[]> {
    return this.http.get<Pet[]>(`${this.base}/pets`);
  }

  byId(id: string): Observable<Pet> {
    return this.http.get<Pet>(`${this.base}/pets/${id}`);
  }

  create(input: CreatePetInput): Observable<Pet> {
    return this.http.post<Pet>(`${this.base}/pets`, input);
  }

  update(id: string, input: CreatePetInput): Observable<Pet> {
    return this.http.patch<Pet>(`${this.base}/pets/${id}`, input);
  }

  hide(id: string): Observable<Pet> {
    return this.http.delete<Pet>(`${this.base}/pets/${id}`);
  }
}
