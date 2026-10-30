import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lesson, LessonSchema } from 'courses/schemas/lesson.schema';
import { Progress, ProgressSchema } from 'courses/schemas/progress.schema';
import { Theme, ThemeSchema } from 'courses/schemas/theme.schema';
import { QuizzesController } from './quizzes.controller';
import { Attempt, AttemptSchema } from './schemas/attempt.schema';
import { QuestionVersion, QuestionVersionSchema } from './schemas/question-version.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: QuestionVersion.name, schema: QuestionVersionSchema }, // 👈 Ajout
         // 👇 Ajouts
      { name: Theme.name, schema: ThemeSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Progress.name, schema: ProgressSchema },
    ]),
  ],
  controllers: [QuizzesController],
})
export class QuizzesModule { }