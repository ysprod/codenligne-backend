import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { AccessService } from './access.service';

class ActivateDto {
  @IsDateString()
  accessEndsAt!: string;
}

class ReasonDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@ApiTags('Admin — Accès')
@Controller('admin/users')
@RequireAdmin()                    // ← JwtAuthGuard + RolesGuard(ADMIN, SUPER_ADMIN)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post(':id/activate')
  @ApiOperation({ summary: 'Active un compte en attente avec une date de fin' })
  async activate(
    @Param('id') id: string,
    @Body() dto: ActivateDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.accessService.activate(id, actor, dto.accessEndsAt);
  }

  @Post(':id/refuse')
  @ApiOperation({ summary: 'Refuse un compte en attente (définitif)' })
  async refuse(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.accessService.refuse(id, actor, dto.reason);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Bloque un compte' })
  async block(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.accessService.block(id, actor, dto.reason);
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Réactive un compte bloqué avec une nouvelle date' })
  async reactivate(
    @Param('id') id: string,
    @Body() dto: ActivateDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.accessService.reactivate(id, actor, dto.accessEndsAt);
  }

  @Post(':id/extend')
  @ApiOperation({ summary: 'Prolonge la date de fin d\'un compte actif' })
  async extend(
    @Param('id') id: string,
    @Body() dto: ActivateDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.accessService.extend(id, actor, dto.accessEndsAt);
  }

  @Get(':id/access-logs')
  @ApiOperation({ summary: 'Historique des décisions d\'accès' })
  async logs(@Param('id') id: string) {
    return this.accessService.getLogs(id);
  }
}