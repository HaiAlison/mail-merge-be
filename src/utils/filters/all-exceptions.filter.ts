import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AxiosError } from 'axios';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi máy chủ nội bộ';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = exceptionResponse.message || exception.message;
        errorCode = exceptionResponse.errorCode || 'HTTP_EXCEPTION';
        details = exceptionResponse.details || null;
      } else {
        message = exceptionResponse || exception.message;
        errorCode = 'HTTP_EXCEPTION';
      }
    } else if (exception instanceof AxiosError) {
      statusCode = exception.response?.status || HttpStatus.BAD_REQUEST;
      message =
        exception.response?.data?.message ||
        exception.message ||
        'Lỗi khi gọi API bên thứ ba';
      errorCode = 'AXIOS_ERROR';
      details = exception.response?.data || null;
    } else if (exception instanceof Error) {
      message = exception.message;

      // TypeORM Specific Exception mapping (optional, but good for standardization)
      if ((exception as any).code === '23505') {
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = 'UNIQUE_CONSTRAINT';
        const match = (exception as any).detail?.match(/Key \((.*?)\)=\((.*?)\)/);
        if (match) {
          message = `Đã tồn tại ${match[1]}: ${match[2]}`;
        } else {
          message = 'Dữ liệu đã tồn tại';
        }
      } else if ((exception as any).code === '23502') {
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = 'NOT_NULL_CONSTRAINT';
        message = `Thiếu dữ liệu bắt buộc: ${(exception as any).column}`;
      }
    }

    const errorResponse = {
      statusCode,
      errorCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {}),
    };

    response.status(statusCode).json(errorResponse);
  }
}
