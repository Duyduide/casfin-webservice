import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@Controller('accounts')
@UseGuards(SessionGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: SessionUser) {
    return this.accountsService.findAll(user.id);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.accountsService.create(user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.accountsService.remove(user.id, id);
  }

  // Manual sync — check lastSyncedAt < 60s → 429
  @Post(':id/sync')
  sync(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.accountsService.manualSync(user.id, id);
  }
}
