import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateThemeDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est obligatoire' })
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}