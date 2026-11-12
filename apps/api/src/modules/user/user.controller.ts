import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';

@ApiTags('demo-users')
@Controller('demo-users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'List demo users (use an id as the x-demo-user-id header)' })
  @Get()
  findAll() {
    return this.userService.findAll();
  }
}
