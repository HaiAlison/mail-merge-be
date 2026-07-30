import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard dùng cho flow reconnect Google.
 * Khác GoogleAuthGuard ở chỗ: luôn force prompt=consent
 * → Google bắt buộc hiển thị màn hình xác nhận và trả về refresh_token mới.
 */
@Injectable()
export class GoogleReconnectGuard extends AuthGuard('google-reconnect') {
  getAuthenticateOptions(_context: ExecutionContext) {
    return {
      accessType: 'offline',
      prompt: 'consent',  // force consent → Google sẽ trả về refresh_token
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.settings.basic',
      ],
    };
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.query['error']) {
      const frontendUrl = process.env.FRONTEND_URL;
      context
        .switchToHttp()
        .getResponse()
        .redirect(
          `${frontendUrl}/auth/callback?error=${request.query['error']}`,
        );
      return false;
    }
    return super.canActivate(context);
  }
}
