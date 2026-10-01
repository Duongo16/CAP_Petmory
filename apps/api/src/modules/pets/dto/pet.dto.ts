import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Gender, PetKind, PetStatus } from '../schemas/pet.schema';

export class MilestoneDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsDateString()
  at!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}

export class CarerDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(100)
  role?: string;
}

export class CreatePetDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsOptional() @IsEnum(PetKind)
  kind?: PetKind;

  @IsOptional() @IsString() @MaxLength(100)
  breed?: string;

  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @IsOptional() @IsDateString()
  birthDate?: string;

  @IsOptional() @IsEnum(PetStatus)
  status?: PetStatus;

  @IsOptional() @IsDateString()
  passedAwayDate?: string;

  @IsOptional() @IsString() @MaxLength(500)
  avatarUrl?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MilestoneDto)
  milestone?: MilestoneDto[];

  @IsOptional() @IsString() @MaxLength(200)
  tagline?: string;

  @IsOptional() @IsDateString()
  adoptionDate?: string;

  @IsOptional() @IsString() @MaxLength(40)
  microchip?: string;

  @IsOptional() @IsBoolean()
  neutered?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true })
  @MaxLength(60, { each: true })
  trait?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(8)
  @ValidateNested({ each: true }) @Type(() => CarerDto)
  carer?: CarerDto[];
}

export class UpdatePetDto extends CreatePetDto {}
