import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    googleLogin(req) {
        if (!req.user) {
            return 'No user from google';
        }
        return {
            message: 'User information from google',
            user: req.user,
        };
    }

    async refreshGoogleToken(refreshToken: string) {
        try {
            const response = await lastValueFrom(
                this.httpService.post('https://oauth2.googleapis.com/token', null, {
                    params: {
                        client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
                        client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
                        refresh_token: refreshToken,
                        grant_type: 'refresh_token',
                    },
                }),
            );
            return response.data;
        } catch (error) {
            throw new InternalServerErrorException('Failed to refresh google token');
        }
    }
}
