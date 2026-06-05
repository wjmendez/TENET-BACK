import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, any>;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // Manejar errores específicos de Fastify
      const errorCode = (exception as any).code;
      const errorMessage = exception.message || '';
      
      // Errores de body vacío con Content-Type JSON
      if (
        errorCode === 'FST_ERR_CTP_EMPTY_JSON_BODY' ||
        errorMessage.includes('Body cannot be empty')
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Body cannot be empty when Content-Type is application/json';
        error = 'Bad Request';
      }
      // Errores de parsing de JSON de Fastify
      else if (
        errorMessage.includes('JSON') ||
        errorMessage.includes('double-quoted') ||
        errorMessage.includes('Unexpected token') ||
        errorMessage.includes('Invalid JSON') ||
        errorCode === 'FST_ERR_VALIDATION'
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = `JSON inválido: ${errorMessage}. Asegúrate de usar comillas dobles (") para las propiedades y valores de cadena, y de que el JSON esté bien formateado.`;
        error = 'Bad Request';
      } else {
        message = errorMessage;
      }
    }

    // Log del error para debugging
    if (status >= 500) {
      console.error('Error:', exception);
    }

    response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    });
  }
}

