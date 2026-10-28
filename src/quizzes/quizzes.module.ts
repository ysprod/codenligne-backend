import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizzesController } from './quizzes.controller';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { Attempt, AttemptSchema } from './schemas/attempt.schema';
import { QuestionVersion, QuestionVersionSchema } from './schemas/question-version.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: QuestionVersion.name, schema: QuestionVersionSchema }, // 👈 Ajout
    ]),
  ],
  controllers: [QuizzesController],
})
export class QuizzesModule { }