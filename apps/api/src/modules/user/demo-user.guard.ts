import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client.js';
import { UserService } from './user.service.js';

export const DEMO_USER_HEADER = 'x-demo-user-id';

export type RequestWithUser = Request & { demoUser: User };

// Stand-in for real auth: a JWT/session guard would load the user the same way.
@Injectable()
export class DemoUserGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.header(DEMO_USER_HEADER);
    if (!userId) {
      throw new UnauthorizedException(`Missing ${DEMO_USER_HEADER} header`);
    }
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Unknown demo user');
    }
    request.demoUser = user;
    return true;
  }
}
