import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  themeId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsObject()
  content!: Record<string, any>;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;
}