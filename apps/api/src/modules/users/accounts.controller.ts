import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import {
  AccountQueryDto,
  ChangeRoleDto,
  CreateAccountDto,
  ResetPasswordDto,
  SetActiveDto,
  SetPetLimitDto,
} from './dto/account.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Quan ly tai khoan.
 *
 * Chi nhom Quan tri vien vao duoc. Day la ranh gioi cua ba nhom quyen: nhom
 * Quan ly lo van hanh nhung khong tao duoc tai khoan, nhom Quan tri vien tao
 * duoc tai khoan nhung khong mo duoc don hang hay bao cao.
 */
@Roles(Role.ADMIN)
@Controller('admin/accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  /** So tai khoan theo tung nhom. Dat truoc duong co tham so de khong bi nuot. */
  @Get('summary')
  summary() {
    return this.service.countByRole();
  }

  @Get()
  list(@Query() query: AccountQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id/role')
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changeRole(id, dto.role, user.userId);
  }

  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setActive(id, dto.active, user.userId);
  }

  @Patch(':id/password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: AuthUser) {
    return this.service.resetPassword(id, dto.password, user.userId);
  }

  @Patch(':id/pet-limit')
  setPetLimit(@Param('id') id: string, @Body() dto: SetPetLimitDto, @CurrentUser() user: AuthUser) {
    return this.service.setPetLimit(id, dto.petProfileLimit, user.userId);
  }
}
