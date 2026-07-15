import { BadRequestException, Injectable } from '@nestjs/common';
import { Signature } from 'src/entity/signatures.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSignatureDto } from './dto/signature.dto';
import { CursorPaginationDto } from 'src/utils/common/dto';
import { cursorPagination } from 'src/utils/common/cursor-pagination';
import { UpdateSignatureDto } from './dto/update-signature.dto';
import { User } from 'src/entity/user.entity';
import { GmailAuthService } from 'src/mail/gmail-auth.service';
import { gmail } from '@googleapis/gmail';
import { SignatureAttachment } from 'src/entity/signature-attachment.entity';
import { pushFileOnCloud } from 'src/utils/common/handle';
import { PushFileOnCloud } from 'src/utils/common/interface';

@Injectable()
export class SignaturesService {
    constructor(
        @InjectRepository(Signature)
        private readonly signatureRepository: Repository<Signature>,
        @InjectRepository(SignatureAttachment)
        private readonly signatureAttachmentRepository: Repository<SignatureAttachment>,
        private readonly gmailAuthService: GmailAuthService,
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
            const saveSignature = await manager.save(Signature, signature, { reload: true });
            if (dto.attachmentIds?.length) {
                manager.createQueryBuilder()
                    .update(SignatureAttachment)
                    .set(
                        { signatureId: saveSignature.id }
                    ).where('id IN (:...ids)', { ids: dto.attachmentIds })
                    .execute();
            }
            return saveSignature;
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

    async uploadSignatureAttachment(file, userId: string) {
        const pushFileDto: PushFileOnCloud = {
            data: Buffer.from(file.buffer),
            dir: 'mail-sig',
            file_name: file.originalname,
            isAttachment: true,
        }
        const fileUploaded = await pushFileOnCloud(pushFileDto);
        const attachment = this.signatureAttachmentRepository.create({
            fileName: fileUploaded.fileName,
            filePath: fileUploaded.filePath,
            fileSize: String(file.size),
            mimeType: fileUploaded.mimeType,
        });
        return await this.signatureAttachmentRepository.save(attachment);
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

    async syncSignature(user: User) {
        let oauth2Client;
        try {
            oauth2Client = await this.gmailAuthService.getOAuth2Client(
                user.id,
            );
            const mail = gmail({ version: 'v1', auth: oauth2Client });
            const { data: { sendAs } } = await mail.users.settings.sendAs.list({ userId: 'me' })
            if (sendAs.length > 0) {
                for (const item of sendAs) {
                    if (!item.signature) continue;

                    // 1. Create/Update the signature from Gmail
                    // const updatedSignature = await this.signatureRepository.manager.transaction(
                    //     async (manager) => {
                    //         const repo = manager.getRepository(Signature);

                    //         const baseData = {
                    //             userId: user.id,
                    //             email: item.sendAsEmail,
                    //             name: item.displayName,
                    //         };

                    //         let result;

                    //     },
                    // );

                    // 2. Sync uploaded attachments (images in signature)
                    // await this.syncSignatureAttachments(item.id, user.id, oauth2Client);
                }
                return sendAs
            }
        } catch (error) {
            console.log(error)
            throw new BadRequestException(error)
        }
    }
}
