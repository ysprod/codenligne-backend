import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    actorId: Types.ObjectId | string;
    action: string;
    targetType: string;
    targetId: string;
    changes?: Record<string, unknown>;
    reason?: string;
    ip?: string;
  }) {
    await this.auditLogModel.create(params);
  }

  async getLogs(limit = 50) {
    return this.auditLogModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'firstName lastName username') // 👈 Important
      .exec();
  }
}