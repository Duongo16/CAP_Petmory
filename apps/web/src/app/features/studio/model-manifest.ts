import { ColorGroup } from '../../core/models/api.model';

/** A material zone declared up front in the manifest file. */
export interface DeclaredZone {
  name: string;
  labelDisplay: string;
  colorGroupAllowed: ColorGroup;
  required: boolean;
}

export interface BaseModel {
  code: string;
  name: string;
  kind: string;
  pose: string;
  file: string;
  ready: boolean;
  temporary?: boolean;
  /** Distinguishes realistic models from blocky ones. */
  styleGroup?: 'REALISTIC' | 'BLOCKY';
}

export interface ModelLibrary {
  version: number;
  description: string;
  zoneMaterial: DeclaredZone[];
  baseModel: BaseModel[];
}
