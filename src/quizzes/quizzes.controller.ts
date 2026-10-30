import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AccessGuard } from '../common/guards/access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { Attempt, AttemptDocument } from './schemas/attempt.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { QuestionVersion, QuestionVersionDocument } from './schemas/question-version.schema';
import { Theme, ThemeDocument } from '../courses/schemas/theme.schema';
import { Lesson, LessonDocument } from '../courses/schemas/lesson.schema';
import { Progress, ProgressDocument } from '../courses/schemas/progress.schema';

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard, AccessGuard)
export class QuizzesController {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(Attempt.name) private attemptModel: Model<AttemptDocument>,
    @InjectModel(QuestionVersion.name) private questionVersionModel: Model<QuestionVersionDocument>,
    @InjectModel(Theme.name) private themeModel: Model<ThemeDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
  ) { }

  // ─── Banque de questions ──────────────────────────────────
  @Post('questions')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async createQuestion(@Body() body: any) {
    return this.questionModel.create({
      statement: body.statement,
      type: body.type || 'SINGLE',
      options: body.options,
      correctOptionIndex: body.type === 'SINGLE' ? body.correctOptionIndex : undefined,
      correctOptionIndexes: body.type === 'MULTIPLE' ? body.correctOptionIndexes : [],
      explanation: body.explanation,
      themeId: body.themeId ? new Types.ObjectId(body.themeId) : undefined,
      difficulty: body.difficulty || 'MEDIUM',
      illustration: body.illustration,
      pedagogicalRef: body.pedagogicalRef,
    });
  }

  @Get('questions')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async getQuestions() {
    return this.questionModel.find().sort({ createdAt: -1 });
  }

  // ─── Création automatique d'un QCM (Admin) ───────────────
  @Post('auto')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async createQuizAuto(@Body() body: any) {
    const { title, mode, passThreshold, durationSec, rules } = body;

    const filter: any = { status: 'PUBLISHED' };
    if (rules.themeId) filter.themeId = new Types.ObjectId(rules.themeId);
    if (rules.difficulty) filter.difficulty = rules.difficulty;

    const availableQuestions = await this.questionModel.find(filter).exec();

    if (availableQuestions.length < rules.questionCount) {
      throw new BadRequestException(
        `Pas assez de questions disponibles. Demandé : ${rules.questionCount}, trouvé : ${availableQuestions.length}.`
      );
    }

    const shuffled = availableQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, rules.questionCount);

    const quiz = await this.quizModel.create({
      title,
      mode,
      passThreshold,
      durationSec,
      questionIds: selectedQuestions.map((q) => q._id),
      status: 'PUBLISHED',
    });

    return quiz;
  }

  // ─── Création d'un QCM ────────────────────────────────────
  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async createQuiz(@Body() body: any) {
    if (!body.questionIds || body.questionIds.length === 0) {
      throw new BadRequestException('Un QCM doit contenir au moins une question.');
    }

    return this.quizModel.create({
      title: body.title,
      description: body.description,
      mode: body.mode,
      passThreshold: body.passThreshold,
      durationSec: body.durationSec,
      questionIds: body.questionIds.map((id: string) => new Types.ObjectId(id)),
      status: 'PUBLISHED',
    });
  }

  @Get()
  async getQuizzes() {
    return this.quizModel.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 });
  }

  // ─── Démarrer un QCM (Apprenant) ───────────────────────────
  @Post(':id/start')
  async startAttempt(@Param('id') quizId: string, @CurrentUser() user: UserDocument) {
    const quiz = await this.quizModel.findById(quizId).populate('questionIds').exec();
    if (!quiz) throw new NotFoundException('QCM introuvable');

    const existingAttempt = await this.attemptModel.findOne({
      userId: user._id,
      quizId: new Types.ObjectId(quizId),
      status: 'IN_PROGRESS'
    });

    if (existingAttempt) {
      if (existingAttempt.expiresAt && new Date() > existingAttempt.expiresAt) {
        return this.finalizeAttempt(existingAttempt, existingAttempt.answers || []);
      }

      return {
        _id: existingAttempt._id,
        drawSnapshot: existingAttempt.drawSnapshot.map((q) => ({
          questionId: q.questionId,
          statement: q.statement,
          type: q.type,
          options: q.options,
        })),
        expiresAt: existingAttempt.expiresAt,
        serverTime: new Date().toISOString(),
      };
    }

    const questions = quiz.questionIds as unknown as QuestionDocument[];
    const drawSnapshot = questions.map((q) => ({
      questionId: q._id.toString(),
      statement: q.statement,
      type: q.type,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      correctOptionIndexes: q.correctOptionIndexes,
      explanation: q.explanation,
      themeId: q.themeId?.toString(), // 👈 LIGNE CRUCIALE AJOUTÉE ICI
    }));

    let expiresAt = undefined;
    if (quiz.durationSec && quiz.durationSec > 0) {
      expiresAt = new Date(Date.now() + quiz.durationSec * 1000);
    }

    const attempt = await this.attemptModel.create({
      userId: user._id,
      quizId: new Types.ObjectId(quizId),
      mode: quiz.mode,
      status: 'IN_PROGRESS',
      drawSnapshot,
      passThreshold: quiz.passThreshold,
      startedAt: new Date(),
      expiresAt,
    });

    return {
      _id: attempt._id,
      drawSnapshot: attempt.drawSnapshot.map((q) => ({
        questionId: q.questionId,
        statement: q.statement,
        type: q.type,
        options: q.options,
      })),
      expiresAt: attempt.expiresAt,
      serverTime: new Date().toISOString(),
    };
  }

  // ─── Soumettre les réponses (Apprenant) ──────────────────────
  @Post('attempts/:attemptId/submit')
  async submitAttempt(
    @Param('attemptId') attemptId: string,
    @Body() body: { answers: { questionId: string; selectedOptionIndexes: number[] }[] },
    @CurrentUser() user: UserDocument,
  ) {
    const attempt = await this.attemptModel.findById(attemptId).exec();
    if (!attempt) throw new NotFoundException('Tentative introuvable');
    if (attempt.userId.toString() !== user._id.toString()) throw new BadRequestException('Non autorisé.');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Déjà finalisée.');

    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      return this.finalizeAttempt(attempt, attempt.answers as any[]);
    }

    return this.finalizeAttempt(attempt, body.answers);
  }

  // ─── Modifier une question (avec versioning) ────────────────
  @Put('questions/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PEDAGOGICAL_MANAGER)
  async updateQuestion(@Param('id') id: string, @Body() body: any) {
    const question = await this.questionModel.findById(id).exec();
    if (!question) throw new NotFoundException('Question introuvable');

    const versionCount = await this.questionVersionModel.countDocuments({ questionId: question._id });

    await this.questionVersionModel.create({
      questionId: question._id,
      versionNumber: versionCount + 1,
      snapshot: question.toObject(),
      status: 'ARCHIVED',
    });

    const updated = await this.questionModel.findByIdAndUpdate(
      id,
      {
        statement: body.statement,
        type: body.type,
        options: body.options,
        correctOptionIndex: body.type === 'SINGLE' ? body.correctOptionIndex : undefined,
        correctOptionIndexes: body.type === 'MULTIPLE' ? body.correctOptionIndexes : [],
        explanation: body.explanation,
        difficulty: body.difficulty,
        illustration: body.illustration,
      },
      { new: true }
    ).exec();

    return updated;
  }

  // ─── Méthode utilitaire de finalisation ──────────────────────
  private async finalizeAttempt(attempt: AttemptDocument, answers: any[]) {
    let correctCount = 0;

    const processedAnswers = attempt.drawSnapshot.map((q) => {
      const ans = answers.find((a) => a.questionId === q.questionId);
      const selected = ans?.selectedOptionIndexes || [];

      let isCorrect = false;
      if (q.type === 'SINGLE') {
        isCorrect = selected.length === 1 && selected[0] === q.correctOptionIndex;
      } else {
        const corrects = q.correctOptionIndexes || [];
        if (selected.length === corrects.length) {
          isCorrect = selected.every((idx: number) => corrects.includes(idx));
        }
      }

      if (isCorrect) correctCount++;

      return {
        questionId: q.questionId,
        selectedOptionIndexes: selected,
      };
    });

    const totalQuestions = attempt.drawSnapshot.length;
    const score20 = totalQuestions > 0 ? (correctCount / totalQuestions) * 20 : 0;
    const passed = score20 >= attempt.passThreshold;

    attempt.answers = processedAnswers;
    attempt.score20 = score20;
    attempt.passed = passed;
    attempt.status = 'COMPLETED';
    attempt.finalizedAt = new Date();
    await attempt.save();

    return {
      _id: attempt._id,
      score20: attempt.score20,
      passed: attempt.passed,
      correctCount,
      totalQuestions,
      finalizedAt: attempt.finalizedAt,
      correction: attempt.drawSnapshot.map((q) => {
        const userAns = processedAnswers.find((a) => a.questionId === q.questionId);
        return {
          questionId: q.questionId,
          statement: q.statement,
          type: q.type,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          correctOptionIndexes: q.correctOptionIndexes,
          explanation: q.explanation,
          userSelectedOptionIndexes: userAns?.selectedOptionIndexes ?? [],
        };
      }),
    };
  }

  // ─── Statistiques Apprenant ──────────────────────────────
  @Get('learner/stats')
  async getLearnerStats(@CurrentUser() user: UserDocument) {
    const attempts = await this.attemptModel.find({ userId: user._id, status: 'COMPLETED' }).sort({ finalizedAt: -1 }).exec();

    if (attempts.length === 0) {
      return { count: 0, averageScore: null, bestScore: null, lastScore: null, history: [] };
    }

    const scores = attempts.map((a) => a.score20);
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const averageScore = sum / scores.length;
    const bestScore = Math.max(...scores);
    const lastScore = scores[0];

    return {
      count: attempts.length,
      averageScore: Number(averageScore.toFixed(2)),
      bestScore: Number(bestScore.toFixed(2)),
      lastScore: Number(lastScore.toFixed(2)),
      history: attempts.slice(0, 5).map((a) => ({
        _id: a._id,
        score20: Number(a.score20.toFixed(2)),
        passed: a.passed,
        finalizedAt: a.finalizedAt,
      })),
    };
  }

  // ─── Rapport PDF (Complet) ────────────────────────────────
  @Get('learner/report')
  async getLearnerReport(@CurrentUser() user: UserDocument) {
    const attempts = await this.attemptModel.find({
      userId: user._id,
      status: 'COMPLETED',
    }).sort({ finalizedAt: -1 }).exec();

    const count = attempts.length;
    let averageScore = null;
    let bestScore = null;
    let lastScore = null;

    if (count > 0) {
      const scores = attempts.map((a) => a.score20);
      const sum = scores.reduce((acc, curr) => acc + curr, 0);
      averageScore = Number((sum / count).toFixed(2));
      bestScore = Number(Math.max(...scores).toFixed(2));
      lastScore = Number(scores[0].toFixed(2));
    }

    const themeStats: Record<string, { total: number; correct: number }> = {};

    for (const attempt of attempts) {
      for (const q of attempt.drawSnapshot) {
        if (!q.themeId) continue;
        
        const themeId = q.themeId;
        if (!themeStats[themeId]) {
          themeStats[themeId] = { total: 0, correct: 0 };
        }

        const userAnswer = attempt.answers.find((a) => a.questionId === q.questionId);
        const selected = userAnswer?.selectedOptionIndexes || [];
        
        let isCorrect = false;
        if (q.type === 'SINGLE') {
          isCorrect = selected.length === 1 && selected[0] === q.correctOptionIndex;
        } else {
          const corrects = q.correctOptionIndexes || [];
          if (selected.length === corrects.length) {
            isCorrect = selected.every((idx: number) => corrects.includes(idx));
          }
        }

        themeStats[themeId].total += 1;
        if (isCorrect) {
          themeStats[themeId].correct += 1;
        }
      }
    }

    const themeIds = Object.keys(themeStats);
    const themes = await this.themeModel.find({ _id: { $in: themeIds } }).exec();
    
    const resultsByTheme = themes.map((theme) => {
      const stat = themeStats[theme._id.toString()];
      const rate = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
      return {
        themeId: theme._id,
        themeTitle: theme.title,
        totalQuestions: stat.total,
        correctAnswers: stat.correct,
        successRate: Math.round(rate),
      };
    });

    const totalLessons = await this.lessonModel.countDocuments({ status: 'PUBLISHED' });
    const completedLessons = await this.progressModel.countDocuments({ userId: user._id });

    return {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
      },
      generatedAt: new Date().toISOString(),
      stats: {
        count,
        averageScore,
        bestScore,
        lastScore,
      },
      courseProgress: {
        totalLessons,
        completedLessons,
      },
      resultsByTheme,
      history: attempts.map((a) => ({
        _id: a._id,
        score20: a.score20,
        passed: a.passed,
        finalizedAt: a.finalizedAt,
      })),
    };
  }
}