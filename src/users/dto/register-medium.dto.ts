import { IsString, IsEmail, IsOptional, MaxLength, IsArray, IsBoolean, IsUrl, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterMediumDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @ValidateIf((o) => !!o.photo)
  photo?: Express.Multer.File;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  spiritualName?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  spiritualQuote?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(1000)
  presentation!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  specialties!: string[];

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  specialtyOther?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  domains!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  methods!: string[];

  @ApiProperty({ type: String })
  @IsString()
  experience!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(500)
  message!: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @ValidateIf((o) => !!o.poster)
  poster?: Express.Multer.File;

 

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @IsUrl()
  videoLink?: string;
}