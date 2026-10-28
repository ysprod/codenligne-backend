import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { AccessStatus } from '../../common/enums/access-status.enum';

/**
 * Création d'un utilisateur (admin only).
 * Le CDC §3 exige : nom, prénom, username unique, téléphone, mot de passe,
 * email facultatif. Le rôle et le statut sont attribuables par un admin.
 */
export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores",
  })
  username!: string;

  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'Numéro de téléphone invalide',
  })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse électronique invalide' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsEnum(['male', 'female', 'other'], {
    message: 'Genre invalide (male, female, other)',
  })
  gender?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  // ─── Réservé aux admins ──────────────────────────────
  @IsOptional()
  @IsEnum(Role, { message: 'Rôle invalide' })
  role?: Role;

  @IsOptional()
  @IsEnum(AccessStatus, { message: 'Statut invalide' })
  status?: AccessStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customPermissions?: string[];

  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
}