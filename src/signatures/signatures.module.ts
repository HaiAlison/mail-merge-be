import { Module } from '@nestjs/common';
import { SignaturesService } from './signatures.service';
import { SignaturesController } from './signatures.controller';
import { Signature } from 'src/entity/signatures.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureAttachment } from 'src/entity/signature-attachment.entity';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Signature, SignatureAttachment]), MailModule
  ],
  controllers: [SignaturesController],
  providers: [SignaturesService],
})
export class SignaturesModule {}
