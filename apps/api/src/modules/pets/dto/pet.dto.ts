import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Gender, PetStatus } from '../schemas/pet.schema';

export class MilestoneDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsDateString()
  at!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}

export class CreatePetDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(50)
  kind?: string;

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
}

export class UpdatePetDto extends CreatePetDto {}
