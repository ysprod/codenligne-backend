import { Body, Controller, Get, Post, Query, Param, UseGuards, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Roles } from '../common/decorators/roles.decorator';
import { ContentStatus } from '../common/enums/content-status.enum';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AccessGuard } from '../common/guards/access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { AuditService } from '../audit/audit.service';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { Theme, ThemeDocument } from './schemas/theme.schema';
import { Chapter, ChapterDocument } from './schemas/chapter.schema';
import { Progress, ProgressDocument } from './schemas/progress.schema';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, AccessGuard)
export class CoursesController {
  constructor(
    @InjectModel(Theme.name) private themeModel: Model<ThemeDocument>,
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    private readonly auditService: AuditService,
  ) {}

  // ─── Routes Admin ────────────────────────────────────────
  @Post('themes')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async createTheme(@Body() dto: any, @CurrentUser() actor: UserDocument) {
    const slug = dto.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await this.themeModel.findOne({ slug });
    if (existing) throw new ConflictException('Un thème avec ce titre existe déjà.');

    const theme = await this.themeModel.create({
      title: dto.title.trim(),
      description: dto.description,
      slug,
      status: ContentStatus.PUBLISHED,
    });

    await this.auditService.log({
      actorId: actor._id,
      action: 'CREATE_THEME',
      targetType: 'Theme',
      targetId: theme._id.toString(),
      changes: { title: theme.title },
    });

    return theme;
  }

  @Post('chapters')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async createChapter(@Body() dto: any, @CurrentUser() actor: UserDocument) {
    if (!Types.ObjectId.isValid(dto.themeId)) throw new ConflictException('ID de thème invalide.');
    
    const slug = dto.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await this.chapterModel.findOne({ slug });
    if (existing) throw new ConflictException('Un chapitre avec ce titre existe déjà.');

    const chapter = await this.chapterModel.create({
      themeId: new Types.ObjectId(dto.themeId),
      title: dto.title.trim(),
      slug,
      status: ContentStatus.PUBLISHED,
    });

    await this.auditService.log({
      actorId: actor._id,
      action: 'CREATE_CHAPTER',
      targetType: 'Chapter',
      targetId: chapter._id.toString(),
      changes: { title: chapter.title, themeId: dto.themeId },
    });

    return chapter;
  }

  @Post('lessons')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async createLesson(@Body() dto: any, @CurrentUser() actor: UserDocument) {
    if (!Types.ObjectId.isValid(dto.chapterId)) throw new ConflictException('ID de chapitre invalide.');

    const slug = dto.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const lesson = await this.lessonModel.create({
      chapterId: new Types.ObjectId(dto.chapterId),
      title: dto.title.trim(),
      slug,
      content: dto.content,
      status: dto.status || ContentStatus.PUBLISHED,
    });

    await this.auditService.log({
      actorId: actor._id,
      action: 'CREATE_LESSON',
      targetType: 'Lesson',
      targetId: lesson._id.toString(),
      changes: { title: lesson.title, chapterId: dto.chapterId },
    });

    return lesson;
  }

  // ─── Routes Apprenant ────────────────────────────────────
  @Get('themes')
  async getThemes() {
    return this.themeModel.find({ status: ContentStatus.PUBLISHED }).sort({ order: 1, createdAt: -1 });
  }

  @Get('chapters')
  async getChapters(@Query('themeId') themeId?: string) {
    const filter: any = { status: ContentStatus.PUBLISHED };
    if (themeId) {
      if (!Types.ObjectId.isValid(themeId)) throw new ConflictException('ID de thème invalide.');
      filter.themeId = new Types.ObjectId(themeId);
    }
    return this.chapterModel.find(filter).sort({ order: 1, createdAt: -1 });
  }

  @Get('lessons')
  async getLessons(@Query('chapterId') chapterId?: string) {
    const filter: any = { status: ContentStatus.PUBLISHED };
    if (chapterId) {
      if (!Types.ObjectId.isValid(chapterId)) throw new ConflictException('ID de chapitre invalide.');
      filter.chapterId = new Types.ObjectId(chapterId);
    }
    return this.lessonModel.find(filter).sort({ order: 1, createdAt: -1 });
  }

  @Get('lessons/:id')
  async getLessonById(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new ConflictException('ID de leçon invalide.');
    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson) throw new ConflictException('Leçon introuvable.');
    return lesson;
  }

  @Post('lessons/:id/complete')
  async completeLesson(@Param('id') lessonId: string, @CurrentUser() user: UserDocument) {
    if (!Types.ObjectId.isValid(lessonId)) {
      throw new ConflictException('ID de leçon invalide.');
    }

    await this.progressModel.findOneAndUpdate(
      { userId: user._id, lessonId: new Types.ObjectId(lessonId) },
      { $setOnInsert: { completedAt: new Date(), completedBy: 'manual' } },
      { upsert: true, new: true }
    );

    return { success: true };
  }

  @Get('progress')
  async getProgress(@CurrentUser() user: UserDocument) {
    const totalLessons = await this.lessonModel.countDocuments({ status: ContentStatus.PUBLISHED });
    const completedLessons = await this.progressModel.countDocuments({ userId: user._id });
    const completedLessonIds = await this.progressModel.find({ userId: user._id }).distinct('lessonId');

    return {
      totalLessons,
      completedLessons,
      completedLessonIds: completedLessonIds.map((id) => id.toString()),
    };
  }
}