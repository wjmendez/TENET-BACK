import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({
    summary: 'Login de usuario',
    description: 'Valida credenciales y retorna un JWT. Usa tenantSlug solo si el usuario pertenece a varios tenants.',
  })
  @ApiBody({
    description: 'Credenciales de acceso',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'admin@certiflow.local' },
        password: { type: 'string', example: 'ChangeMe123!' },
        tenantSlug: { type: 'string', example: 'default' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'JWT emitido' })
  async login(
    @Req() req: FastifyRequest,
    @Body() body: { email: string; password: string; tenantSlug?: string },
  ) {
    return this.authService.login({
      ...body,
      tenantSlug: body.tenantSlug || req.tenantSlug,
    });
  }

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Registro de usuario',
    description: 'Crea usuario, tenant y membership OWNER, y retorna un JWT.',
  })
  @ApiBody({
    description: 'Datos de registro',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'owner@certiflow.local' },
        password: { type: 'string', example: 'ChangeMe123!' },
        name: { type: 'string', example: 'Owner Name' },
        tenantName: { type: 'string', example: 'Acme University' },
        tenantSlug: { type: 'string', example: 'acme-university' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Usuario registrado' })
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      name?: string;
      tenantName?: string;
      tenantSlug?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Get('tenants')
  @ApiOperation({
    summary: 'Listar tenants del usuario',
    description: 'Retorna los tenants asociados al usuario autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Lista de tenants' })
  async listTenants(@Req() req: FastifyRequest) {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.authService.listUserTenants(userId);
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout de usuario',
    description: 'Invalida la sesion del lado cliente. El token debe descartarse.',
  })
  @ApiResponse({ status: 200, description: 'Logout exitoso' })
  async logout() {
    return { status: 'ok' };
  }
}
