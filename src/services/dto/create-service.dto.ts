import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { ConsultationType } from '../../common/enums/consultation-status.enum';

export class CreateServiceDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsString()
  @IsOptional()
  longDescription?: string;

  @IsEnum(ConsultationType)
  type: ConsultationType;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPrice?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
