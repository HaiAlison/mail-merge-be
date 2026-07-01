import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    return {
      accessType: 'offline',
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.send'],
    };
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.query['error']) {
      console.error(
        'Google OAuth Error:',
        request.query['error'],
      );
      const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3003').split(',')[0];
      context
        .switchToHttp()
        .getResponse()
        .redirect(`${frontendUrl}/auth/callback?error=${request.query['error']}`);
      return false;
    }
    return super.canActivate(context);
  }
}
