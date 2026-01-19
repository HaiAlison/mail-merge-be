import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    constructor() {
        super({
            accessType: 'offline',
            prompt: 'consent',
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.send'],
        });
    }
    canActivate(context: ExecutionContext) {
        if (context.switchToHttp().getRequest().query['error']) {
            console.error(
                'Google OAuth Error:',
                context.switchToHttp().getRequest().query['error'],
            );
            //redirect to frontend with error
            context
                .switchToHttp()
                .getResponse()
                .redirect(`${process.env.FRONTEND_URL}/auth/callback?error=1`);
        }
        return super.canActivate(context);
    }
}
