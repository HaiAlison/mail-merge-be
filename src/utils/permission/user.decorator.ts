import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['authorization']
      ? req.headers['authorization']
      : null;
    if (token) {
      const base64Payload = token.split('.')[1];
      const payloadBuffer = Buffer.from(base64Payload, 'base64');
      const updatedJwtPayload = JSON.parse(payloadBuffer.toString());
      return updatedJwtPayload;
    }
    return null;
  },
);
