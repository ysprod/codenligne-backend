import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesController } from './courses.controller';
import { Theme, ThemeSchema } from './schemas/theme.schema';
import { Chapter, ChapterSchema } from './schemas/chapter.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { AuditModule } from '../audit/audit.module'; // 👈 Ajout
import { Progress, ProgressSchema } from './schemas/progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Theme.name, schema: ThemeSchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Progress.name, schema: ProgressSchema },
    ]),
    AuditModule, // 👈 Ajout
  ],
  controllers: [CoursesController],
})
export class CoursesModule {}