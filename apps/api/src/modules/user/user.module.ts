import { Module } from '@nestjs/common';
import { DemoUserGuard } from './demo-user.guard.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

@Module({
  controllers: [UserController],
  providers: [UserService, DemoUserGuard],
  exports: [UserService, DemoUserGuard],
})
export class UserModule {}
