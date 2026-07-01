import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

const jwtService = new JwtService();

@Injectable()
export class ApiAuthBearerGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      const data = jwtService.verify(request.headers['authorization']?.split('Bearer ')[1], { secret: process.env.JWT_SECRET })
      if (data) return true;
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    } catch (e) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    } finally {
    }
  }
}
