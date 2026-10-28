import { ApiProperty } from '@nestjs/swagger';
import { UserGrade } from '../../common/enums/user-grade.enum';

export class RubriqueProgressDto {
  @ApiProperty()
  rubriqueId: string;

  @ApiProperty()
  rubriqueTitle: string;

  @ApiProperty()
  required: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  progress: number;
}

export class GradeProgressDto {
  @ApiProperty({ enum: UserGrade, nullable: true })
  currentGrade: UserGrade | null;

  @ApiProperty({ enum: UserGrade, nullable: true })
  nextGrade: UserGrade | null;

  @ApiProperty()
  consultationsCompleted: number;

  @ApiProperty({ type: [RubriqueProgressDto], required: false, nullable: true })
  consultationsParRubrique?: RubriqueProgressDto[] | null;

  @ApiProperty()
  rituelsCompleted: number;

  @ApiProperty()
  booksRead: number;

  @ApiProperty({ required: false, nullable: true })
  nextGradeRequirements?: {
    consultationsParRubrique: number;
    rituels: number;
    livres: number;
  } | null;

  @ApiProperty({ required: false, nullable: true })
  progress?: {
    consultationsParRubrique: number;
    rituels: number;
    livres: number;
  } | null;

  @ApiProperty({ required: false, nullable: true })
  userGradeProgress: any | null;
}

export class GradeInfoDto {
  @ApiProperty({ enum: UserGrade })
  grade: UserGrade;

  @ApiProperty()
  level: number;

  @ApiProperty()
  requirements: {
    consultations: number;
    rituels: number;
    livres: number;
  };
}

export class GradeUpdateResponseDto {
  @ApiProperty()
  updated: boolean;

  @ApiProperty({ enum: UserGrade, nullable: true })
  oldGrade: UserGrade | null;

  @ApiProperty({ enum: UserGrade, nullable: true })
  newGrade: UserGrade | null;

  @ApiProperty({ required: false })
  message?: string;
}
