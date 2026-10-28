import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO du self-service `PATCH /users/me`.
 *
 * Liste blanche explicite : jamais `role`, `customPermissions`, `isActive`,
 * `username` ni `password` (parcours dédié). Dériver d'UpdateUserDto laissait
 * passer `customPermissions` → SUPER_ADMIN en deux requêtes (audit OWASP A01-1).
 */
export class UpdateMyProfileDto extends PartialType(CreateUserDto) {}