import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { AccessStatus } from '../common/enums/access-status.enum';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { User, UserDocument } from './schemas/user.schema';
import { escapeRegExp } from '../common/regexp.util';
import { Attempt, AttemptDocument } from '../quizzes/schemas/attempt.schema';
import { AccessLog, AccessLogDocument } from '../access/schemas/access-log.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attempt.name) private attemptModel: Model<AttemptDocument>,
    @InjectModel(AccessLog.name) private accessLogModel: Model<AccessLogDocument>,
    private configService: ConfigService,
  ) {}

  // ─── Statistiques (CDC §6) ────────────────────────────
  async getGlobalStatistics() {
    const [total, pending, active, refused, blocked, expired] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel.countDocuments({ status: 'PENDING' }).exec(),
      this.userModel.countDocuments({ status: 'ACTIVE' }).exec(),
      this.userModel.countDocuments({ status: 'REFUSED' }).exec(),
      this.userModel.countDocuments({ status: 'BLOCKED' }).exec(),
      this.userModel.countDocuments({
        status: 'ACTIVE',
        accessEndsAt: { $lt: new Date() },
      }).exec(),
    ]);

    return {
      users: { total, pending, active, refused, blocked, expired },
    };
  }

  // ─── Création (admin only) ───────────────────────────
  async create(createUserDto: CreateUserDto): Promise<User> {
    const {
      username, password, gender, phone, email, firstName, lastName, role, customPermissions,
    } = createUserDto;

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    const existing = await this.userModel
      .findOne({ $or: [{ username: normalizedUsername }, { phone: normalizedPhone }] })
      .exec();

    if (existing) {
      throw new ConflictException("Ce nom d'utilisateur ou ce téléphone est déjà utilisé.");
    }

    const saltRounds = Number(this.configService.get('BCRYPT_ROUNDS', 10)) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = new this.userModel({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: normalizedUsername,
      phone: normalizedPhone,
      email: email?.trim().toLowerCase() || undefined,
      gender,
      password: hashedPassword,
      role: role || Role.LEARNER,
      customPermissions: customPermissions || [],
      status: AccessStatus.PENDING,
    });

    await user.save();
    const { password: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword as any;
  }

  // ─── Gestion des collaborateurs ───────────────────────
  async createCollaborator(dto: CreateUserDto): Promise<User> {
    if (dto.role !== Role.ADMIN && dto.role !== Role.PEDAGOGICAL_MANAGER) {
      throw new ForbiddenException('Le rôle doit être ADMIN ou PEDAGOGICAL_MANAGER.');
    }
    // Le collaborateur est créé directement ACTIF
    const user = await this.create(dto);
    return this.userModel.findByIdAndUpdate(user._id, { status: AccessStatus.ACTIVE }, { new: true }).exec() as Promise<User>;
  }

  async getCollaborators() {
    return this.userModel.find({
      role: { $in: [Role.ADMIN, Role.PEDAGOGICAL_MANAGER, Role.SUPER_ADMIN] },
    }).select('-password').sort({ createdAt: -1 });
  }

  // ─── Liste avec filtres et pagination ───────────────
  async findAll(query: { page?: number; limit?: number; role?: Role; status?: AccessStatus; search?: string; }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    if (query.search?.trim()) {
      const safe = escapeRegExp(query.search.trim());
      filter.$or = [
        { firstName: { $regex: safe, $options: 'i' } },
        { lastName: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.userModel.find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpires -currentRefreshTokenHash -currentRefreshTokenIssuedAt')
        .skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Détail ──────────────────────────────────────────
  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpires -currentRefreshTokenHash -currentRefreshTokenIssuedAt')
      .exec();

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const obj = user.toObject();
    if (obj.status === AccessStatus.ACTIVE && obj.accessEndsAt && new Date(obj.accessEndsAt) < new Date()) {
      obj.status = AccessStatus.EXPIRED;
    }
    return obj as any;
  }

  // ─── Mise à jour (admin) ─────────────────────────────
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password -resetPasswordToken -resetPasswordExpires').exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ─── Self-service (apprenant) ────────────────────────
  async updateMyProfile(userId: string, dto: UpdateMyProfileDto): Promise<User> {
    if (dto.phone) {
      const existing = await this.userModel.findOne({ phone: dto.phone.trim(), _id: { $ne: userId } }).exec();
      if (existing) throw new ConflictException('Ce numéro de téléphone est déjà utilisé.');
    }
    if (dto.email) {
      const existing = await this.userModel.findOne({ email: dto.email.trim().toLowerCase(), _id: { $ne: userId } }).exec();
      if (existing) throw new ConflictException('Cette adresse électronique est déjà utilisée.');
    }

    const update: Record<string, unknown> = {};
    if (dto.firstName) update.firstName = dto.firstName.trim();
    if (dto.lastName) update.lastName = dto.lastName.trim();
    if (dto.email !== undefined) update.email = dto.email?.trim().toLowerCase() || undefined;
    if (dto.gender) update.gender = dto.gender;
    if (dto.phone) update.phone = dto.phone.trim();

    const user = await this.userModel.findByIdAndUpdate(userId, update, { new: true })
      .select('-password -resetPasswordToken -resetPasswordExpires').exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ─── Changement de mot de passe ──────────────────────
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new ForbiddenException('Mot de passe actuel incorrect');
    const saltRounds = Number(this.configService.get('BCRYPT_ROUNDS', 10)) || 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
  }

  // ─── Assigner un rôle ────────────────────────────────
  async assignRole(userId: string, role: Role): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(userId, { role }, { new: true })
      .select('-password -resetPasswordToken -resetPasswordExpires').exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ─── Détail complet pour l'admin ─────────────────────
  async getUserDetail(id: string) {
    const user = await this.findOne(id);

    const accessLogs = await this.accessLogModel.find({ userId: new Types.ObjectId(id) })
      .sort({ createdAt: -1 }).populate('actorId', 'firstName lastName').limit(10).exec();

    const attempts = await this.attemptModel.find({ userId: new Types.ObjectId(id), status: 'COMPLETED' })
      .sort({ finalizedAt: -1 }).exec();

    let averageScore = null;
    let bestScore = null;
    if (attempts.length > 0) {
      const scores = attempts.map((a) => a.score20);
      averageScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
      bestScore = Number(Math.max(...scores).toFixed(2));
    }

    return {
      user, accessLogs,
      stats: {
        count: attempts.length, averageScore, bestScore,
        history: attempts.slice(0, 5).map((a) => ({
          _id: a._id, score20: Number(a.score20.toFixed(2)), passed: a.passed, finalizedAt: a.finalizedAt,
        })),
      },
    };
  }
}