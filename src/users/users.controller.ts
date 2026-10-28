import {
  Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { RequireSuperAdmin } from '../common/decorators/require-super-admin.decorator';
import { AccessStatus } from '../common/enums/access-status.enum';
import { Role } from '../common/enums/role.enum';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('Utilisateurs')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Espace apprenant ──────────────────────────────────
  @Get('me')
  getMyProfile(@CurrentUser() user: UserDocument) {
    return this.usersService.findOne(user._id.toString());
  }

  @Patch('me')
  updateMyProfile(@CurrentUser() user: UserDocument, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(user._id.toString(), dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeMyPassword(@CurrentUser() user: UserDocument, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(user._id.toString(), dto);
  }

  // ─── Admin ─────────────────────────────────────────────
  @Get()
  @RequireAdmin()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: Role,
    @Query('status') status?: AccessStatus,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ page, limit, role, status, search });
  }

  @Get('statistics')
  @RequireAdmin()
  async getStatistics() {
    return this.usersService.getGlobalStatistics();
  }

  // ─── Super Admin ───────────────────────────────────────
  @Get('collaborators')
  @RequireSuperAdmin()
  async getCollaborators() {
    return this.usersService.getCollaborators();
  }

  @Patch('collaborators/:id/role')
  @RequireSuperAdmin()
  async updateCollaboratorRole(
    @Param('id') id: string,
    @Body('role') role: Role,
    @CurrentUser() actor: UserDocument,
  ) {
    // Un super admin ne peut pas changer son propre rôle
    if (id === actor._id.toString()) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle.');
    }

    // On ne peut pas retirer le dernier super admin
    if (role !== Role.SUPER_ADMIN) {
      const superAdminCount = await this.usersService['userModel'].countDocuments({ 
        role: Role.SUPER_ADMIN, status: AccessStatus.ACTIVE 
      });
      const target = await this.usersService['userModel'].findById(id);
      if (target?.role === Role.SUPER_ADMIN && superAdminCount <= 1) {
        throw new ForbiddenException('Impossible de retirer le dernier super administrateur actif.');
      }
    }

    return this.usersService.assignRole(id, role);
  }

  // ─── Routes avec :id ───────────────────────────────────
  @Get(':id/detail')
  @RequireAdmin()
  async getUserDetail(@Param('id') id: string) {
    return this.usersService.getUserDetail(id);
  }

  @Get(':id')
  @RequireAdmin()
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ─── Création de collaborateur (doit être avant :id) ───
  @Post('collaborators')
  @RequireSuperAdmin()
  async createCollaborator(@Body() dto: CreateUserDto) {
    return this.usersService.createCollaborator(dto);
  }
}