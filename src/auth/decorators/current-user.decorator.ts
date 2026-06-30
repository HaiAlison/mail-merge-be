import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../entity/user.entity';

/**
 * Extracts the authenticated user from the request.
 * Requires JWT AuthGuard to be applied to the route.
 *
 * @example
 * \@Get('profile')
 * \@UseGuards(AuthGuard('jwt'))
 * getProfile(\@CurrentUser() user: User) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as User;
  },
);
