import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { ProductionFileService } from './production-file.service';
import { DesignsService } from '../designs/designs.service';
import { PreviewAngle } from '../designs/schemas/design.schema';
import { ChangeStatusDto, OrderFilterDto, CustomerSearchDto } from './dto/admin.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Operations screens for internal staff.
 *
 * All three internal groups can read. Only Manager and Admin may move an order
 * by hand, because that action changes cash flow and the production schedule.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly profile: ProductionFileService,
    private readonly designs: DesignsService,
  ) {}

  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPPORT)
  @Get('orders/stats')
  stats() {
    return this.service.countByStatus();
  }

  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPPORT)
  @Get('orders')
  listOrder(@Query() filter: OrderFilterDto) {
    return this.service.listOrder(filter);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Get('orders/:orderCode/production-file')
  productionFile(@Param('orderCode') orderCode: string) {
    return this.profile.buildProfile(orderCode);
  }

  /**
   * Serves a design preview to internal staff.
   * The workshop needs to see what the customer approved, so ownership is not
   * checked here; in exchange this path is open only to the two operations groups.
   */
  @Roles(Role.MANAGER, Role.ADMIN)
  @Get('designs/:id/preview/:angle')
  async photoDesign(
    @Param('id') id: string,
    @Param('angle') angle: PreviewAngle,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.designs.readPhotoAwaitingInternal(id, angle);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }

  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPPORT)
  @Get('orders/:orderCode')
  detailOrder(@Param('orderCode') orderCode: string) {
    return this.service.detailOrder(orderCode);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Patch('orders/:orderCode/status')
  changeStatus(
    @Param('orderCode') orderCode: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changeOrderStatus(orderCode, dto.status, user.userId, dto.reason ?? '');
  }

  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPPORT)
  @Get('customers')
  listCustomers(@Query() filter: CustomerSearchDto) {
    return this.service.listCustomers(filter);
  }

  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPPORT)
  @Get('customers/:id')
  customerDetail(@Param('id') id: string) {
    return this.service.customerDetail(id);
  }
}
