import { IsEnum, IsMongoId, IsOptional, IsDateString } from 'class-validator';
import { UserType } from '../../common/enums/user-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserTypeDto {
  @ApiProperty({
    enum: UserType,
    description: 'Type de profil utilisateur',
  })
  @IsEnum(UserType)
  userType: UserType;

  @ApiProperty({
    description: 'ID de la rubrique autorisée (uniquement pour Premium)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  premiumRubriqueId?: string;

  @ApiProperty({
    description: 'Date de début d\'abonnement',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  subscriptionStartDate?: string;

  @ApiProperty({
    description: 'Date de fin d\'abonnement',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  subscriptionEndDate?: string;
}

export class UserTypeResponseDto {
  @ApiProperty()
  userType: UserType;

  @ApiProperty({ required: false })
  premiumRubriqueId?: string;

  @ApiProperty({ required: false })
  subscriptionStartDate?: Date;

  @ApiProperty({ required: false })
  subscriptionEndDate?: Date;

  @ApiProperty({ required: false })
  isSubscriptionActive?: boolean;
}
