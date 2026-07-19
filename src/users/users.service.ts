import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entity/user.entity';

export type UpsertGoogleUserInput = {
  googleProviderId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  picture?: string | null;
  /** Chỉ cập nhật khi Google trả về (thường là lần đầu / sau khi revoke consent) */
  googleRefreshToken?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Create or update a user from Google OAuth profile data */
  async upsertGoogleUser(input: UpsertGoogleUserInput): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { googleProviderId: input.googleProviderId },
    });

    if (!user) {
      user = this.userRepository.create({
        googleProviderId: input.googleProviderId,
        email: input.email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        picture: input.picture ?? null,
        googleRefreshToken: input.googleRefreshToken ?? null,
      });
      return this.userRepository.save(user);
    }

    user.email = input.email;
    user.firstName = input.firstName ?? user.firstName;
    user.lastName = input.lastName ?? user.lastName;
    user.picture = input.picture ?? user.picture;
    if (input.googleRefreshToken) {
      user.googleRefreshToken = input.googleRefreshToken;
    }
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  toPublicUser(user: User) {
    const { googleRefreshToken: _, password: __, ...rest } = user;
    return rest;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<User> {
    const user = await this.findById(userId);
    if (dto.rateLimitPerMinute !== undefined) {
      user.rateLimitPerMinute = dto.rateLimitPerMinute;
    }
    if (dto.dailyLimit !== undefined) {
      user.dailyLimit = dto.dailyLimit;
    }
    return this.userRepository.save(user);
  }
}
