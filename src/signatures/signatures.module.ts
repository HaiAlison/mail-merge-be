import { Module } from '@nestjs/common';
import { SignaturesService } from './signatures.service';
import { SignaturesController } from './signatures.controller';
import { Signature } from 'src/entity/signatures.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureAttachment } from 'src/entity/signature-attachment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Signature, SignatureAttachment])],
  controllers: [SignaturesController],
  providers: [SignaturesService],
})
export class SignaturesModule {}
