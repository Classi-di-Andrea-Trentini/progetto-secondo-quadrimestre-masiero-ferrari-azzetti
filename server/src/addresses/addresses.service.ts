import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.userAddress.create({
      data: { userId, ...dto, country: dto.country ?? 'IT' },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.assertOwner(userId, id);
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, NOT: { id } },
        data: { isDefault: false },
      });
    }
    return this.prisma.userAddress.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.userAddress.delete({ where: { id } });
  }

  async setDefault(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.userAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    return this.prisma.userAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  private async assertOwner(userId: string, id: string) {
    const addr = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!addr) throw new NotFoundException('Address not found');
    if (addr.userId !== userId) throw new ForbiddenException();
  }
}
