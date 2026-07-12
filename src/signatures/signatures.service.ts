import { Injectable } from '@nestjs/common';
import { Signature } from 'src/entity/signatures.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSignatureDto } from './dto/signature.dto';
import { CursorPaginationDto } from 'src/utils/common/dto';
import { cursorPagination } from 'src/utils/common/cursor-pagination';
import { UpdateSignatureDto } from './dto/update-signature.dto';

@Injectable()
export class SignaturesService {
    constructor(
        @InjectRepository(Signature)
        private readonly signatureRepository: Repository<Signature>
    ) {}

    async createSignature(userId: string, dto: CreateSignatureDto) {
        return this.signatureRepository.manager.transaction(async (manager) => {
            const signature = manager.create(Signature, dto);
            signature.userId = userId;

            if (dto.isDefault) {
                await manager.update(Signature, { userId, isDefault: true }, { isDefault: false });
            } else {
                const hasDefault = await manager.count(Signature, {
                    where: { userId, isDefault: true },
                });
                if (hasDefault === 0) {
                    signature.isDefault = true;
                }
            }
            return await manager.save(Signature, signature);
        });
    }

    async updateSignature(id: string, dto: UpdateSignatureDto, userId: string) {
        return this.signatureRepository.manager.transaction(async (manager) => {
            const signature = await manager.findOne(Signature, {
                where: { id, userId },
            });
            if (!signature) {
                throw new Error('Signature not found');
            }

            if (dto.isDefault === true) {
                // Unset any existing default signatures for this user
                await manager.update(Signature, { userId, isDefault: true }, { isDefault: false });
            }

            if (dto.name !== undefined) signature.name = dto.name;
            if (dto.content !== undefined) signature.content = dto.content;
            if (dto.isDefault !== undefined) signature.isDefault = dto.isDefault;

            return await manager.save(Signature, signature);
        });
    }

    async deleteSignature(id: string, userId: string) {
        const result = await this.signatureRepository.delete({ id, userId });
        if (result.affected === 0) {
            throw new Error('Signature not found');
        }
        return { success: true };
    }

    async getAllSignatures(cursor: CursorPaginationDto, userId: string) {
        const query = this.signatureRepository.createQueryBuilder('signature')
            .where('signature.userId = :userId', { userId })
            .addSelect('signature.updatedAt')
            .addSelect('signature.createdAt')
            .orderBy('signature.isDefault', 'DESC');
        return cursorPagination(query, cursor);
    }

    async getSignatureDetail(id: string) {
        return this.signatureRepository.findOne({
            where: { id },
        });
    }
}
