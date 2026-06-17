import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('accounts')
@ApiCookieAuth()
@Controller('accounts')
@UseGuards(SessionGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách ví của user' })
  @ApiResponse({ status: 200, description: 'Danh sách ví' })
  findAll(@CurrentUser() user: SessionUser) {
    return this.accountsService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo ví mới (tiền mặt, quỹ, v.v.)' })
  @ApiResponse({ status: 201, description: 'Ví đã được tạo' })
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: SessionUser) {
    return this.accountsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin ví' })
  @ApiParam({ name: 'id', description: 'ID của ví' })
  @ApiResponse({ status: 200, description: 'Ví đã được cập nhật' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() user: SessionUser) {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa ví' })
  @ApiParam({ name: 'id', description: 'ID của ví' })
  @ApiResponse({ status: 200, description: 'Ví đã được xóa' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.accountsService.remove(user.id, id);
  }
}
