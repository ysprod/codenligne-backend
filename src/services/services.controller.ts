import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/enums/permission.enum';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.CREATE_SERVICE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un service', description: 'Crée un nouveau service.' })
  @ApiResponse({ status: 201, description: 'Service créé.' })
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lister les services',
    description: 'Retourne la liste des services disponibles.',
  })
  @ApiResponse({ status: 200, description: 'Liste des services.' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.servicesService.findAll({ page, limit, type, isActive });
  }
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Obtenir un service',
    description: 'Retourne les détails d’un service par son ID.',
  })
  @ApiResponse({ status: 200, description: 'Détails du service.' })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.servicesService.findBySlug(slug);
  }

  /** Activer/désactiver un service (toggle uniforme de l'écran de gestion) */
  @Patch(':id/active')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.UPDATE_SERVICE)
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.servicesService.update(id, { isActive: Boolean(isActive) } as UpdateServiceDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.UPDATE_SERVICE)
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.DELETE_SERVICE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.servicesService.remove(id);
  }
}
