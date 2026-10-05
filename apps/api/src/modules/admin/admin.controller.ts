import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { ProductionFileService } from './production-file.service';
import { DesignsService } from '../designs/designs.service';
import { PreviewAngle } from '../designs/schemas/design.schema';
import {
  ChangeStatusDto,
  ClearAttentionDto,
  AuditQueryDto,
  OrderFilterDto,
  CustomerSearchDto,
  QualityTickDto,
} from './dto/admin.dto';
import { HideDiaryDto, ModerationQueryDto } from '../memories/dto/diary.dto';
import { DiaryService } from '../memories/diary.service';
import { AuditService } from '../../common/audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { DESK, Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/** Loai tai nguyen ghi vao nhat ky he thong khi an mot quyen nhat ky. */
const RESOURCE_TYPE_DIARY = 'PetDiary';

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
    private readonly diary: DiaryService,
    private readonly audit: AuditService,
  ) {}

  @Roles(...DESK)
  @Get('orders/stats')
  stats() {
    return this.service.countByStatus();
  }

  @Roles(...DESK)
  @Get('orders')
  listOrder(@Query() filter: OrderFilterDto) {
    return this.service.listOrder(filter);
  }

  @Roles(Role.MANAGER)
  @Get('orders/:orderCode/production-file')
  productionFile(@Param('orderCode') orderCode: string) {
    return this.profile.buildProfile(orderCode);
  }

  /**
   * Serves a design preview to internal staff.
   * The workshop needs to see what the customer approved, so ownership is not
   * checked here; in exchange this path is open only to the two operations groups.
   */
  /** Anh tham chieu khach gui cho mot don, chi khi anh thuoc dung don do. */
  @Roles(Role.MANAGER)
  @Get('orders/:orderCode/photos/:photoId')
  async orderPhoto(
    @Param('orderCode') orderCode: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const found = await this.profile.readOrderPhoto(orderCode, photoId);
    res.setHeader('Content-Type', found.fileType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(found.data);
  }

  @Roles(Role.MANAGER)
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

  @Roles(...DESK)
  @Get('orders/:orderCode')
  detailOrder(@Param('orderCode') orderCode: string) {
    return this.service.detailOrder(orderCode);
  }

  @Roles(Role.MANAGER)
  @Patch('orders/:orderCode/status')
  changeStatus(
    @Param('orderCode') orderCode: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changeOrderStatus(orderCode, dto.status, user.userId, dto.reason.trim());
  }

  /** Nhat ky thao tac (muc 14): Quan tri vien va Quan ly doc duoc, khong ai sua duoc. */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('audit')
  auditLog(@Query() query: AuditQueryDto) {
    return this.audit.search({
      resourceType: query.resourceType,
      action: query.action,
      resourceId: query.resourceId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
    });
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('audit/facets')
  auditFacets() {
    return this.audit.facets();
  }

  /** Bo co can xu ly khi nhan vien da xu ly xong, kem ghi chu. */
  @Roles(Role.MANAGER)
  @Patch('orders/:orderCode/attention')
  clearAttention(
    @Param('orderCode') orderCode: string,
    @Body() dto: ClearAttentionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.clearAttention(orderCode, user.userId, dto.note.trim());
  }

  @Roles(Role.MANAGER)
  @Patch('orders/:orderCode/quality/:at')
  setQualityTick(
    @Param('orderCode') orderCode: string,
    @Param('at', ParseIntPipe) at: number,
    @Body() dto: QualityTickDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setQualityTick(orderCode, at, dto.done, user.userId);
  }

  /**
   * An mot quyen nhat ky khoi cong dong.
   *
   * Ly do la bat buoc, va duoc ghi vao nhat ky he thong kem ten nguoi lam,
   * vi day la mot quyet dinh cham den noi dung cua nguoi khac.
   */
  /** Man kiem duyet nhat ky cong dong: nhom Quan tri vien theo hop dong, kem nhom Quan ly. */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('diaries')
  moderationList(@Query() query: ModerationQueryDto) {
    return this.diary.moderationList(query.page ?? 1, query.state ?? 'PUBLIC', query.keyword);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('diaries/:petId/block')
  async blockDiary(
    @Param('petId') petId: string,
    @Body() dto: HideDiaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const pet = await this.diary.blockDiary(petId, dto.reason, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'DIARY_BLOCKED',
      resourceType: RESOURCE_TYPE_DIARY,
      resourceId: pet._id.toString(),
      reason: dto.reason,
      after: { diaryBlocked: true },
    });
    return pet;
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch('diaries/:petId/unblock')
  async unblockDiary(@Param('petId') petId: string, @CurrentUser() user: AuthUser) {
    const pet = await this.diary.unblockDiary(petId);
    await this.audit.write({
      actor: user.userId,
      action: 'DIARY_UNBLOCKED',
      resourceType: RESOURCE_TYPE_DIARY,
      resourceId: pet._id.toString(),
      after: { diaryBlocked: false },
    });
    return pet;
  }

  @Roles(...DESK)
  @Get('customers')
  listCustomers(@Query() filter: CustomerSearchDto) {
    return this.service.listCustomers(filter);
  }

  @Roles(...DESK)
  @Get('customers/:id')
  customerDetail(@Param('id') id: string) {
    return this.service.customerDetail(id);
  }
}
