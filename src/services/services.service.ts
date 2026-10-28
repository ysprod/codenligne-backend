import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(@InjectModel(Service.name) private serviceModel: Model<ServiceDocument>) {}

  async create(createServiceDto: CreateServiceDto) {
    const existing = await this.serviceModel.findOne({ slug: createServiceDto.slug }).exec();
    if (existing) {
      throw new ConflictException('Service with this slug already exists');
    }

    const service = new this.serviceModel(createServiceDto);
    return service.save();
  }

  async findAll(query: { page?: number; limit?: number; type?: string; isActive?: boolean }) {
    const { page = 1, limit = 20, type, isActive } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive;

    const [services, total] = await Promise.all([
      this.serviceModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.serviceModel.countDocuments(filter).exec(),
    ]);

    return { services, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const service = await this.serviceModel.findById(id).exec();
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async findBySlug(slug: string) {
    const service = await this.serviceModel.findOne({ slug }).exec();
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async update(id: string, updateServiceDto: UpdateServiceDto) {
    const service = await this.serviceModel
      .findByIdAndUpdate(id, updateServiceDto, { new: true })
      .exec();
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async remove(id: string) {
    const service = await this.serviceModel.findByIdAndDelete(id).exec();
    if (!service) throw new NotFoundException('Service not found');
  }
}
