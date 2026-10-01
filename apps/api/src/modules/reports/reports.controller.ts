import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsDateString, IsOptional } from 'class-validator';
import { Period, ReportsService } from './reports.service';
import { asCsv } from './csv';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';

/** Khoang thoi gian nguoi xem chon. De trong thi lay ba muoi ngay gan nhat. */
class PeriodDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Mac dinh nhin lai bao nhieu ngay khi nguoi xem chua chon khoang nao. */
const DEFAULT_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * Ba bao cao quan tri.
 *
 * Bao cao chi doc: khong duong nao o day ghi duoc gi vao du lieu. Doanh thu
 * va chi phi chi mo cho nhom Quan ly, con tien do san xuat thi Quan tri vien
 * cung can de dieu phoi xuong.
 */
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Roles(Role.MANAGER)
  @Get('revenue')
  revenue(@Query() query: PeriodDto) {
    return this.service.revenue(periodOf(query));
  }

  @Roles(Role.MANAGER)
  @Get('revenue.csv')
  async revenueCsv(@Query() query: PeriodDto, @Res() res: Response): Promise<void> {
    const report = await this.service.revenue(periodOf(query));
    const rows = [
      ...report.byKind.map((one) => ['Nhóm hàng', one.name, one.count, one.amount]),
      ...report.byProduct.map((one) => ['Sản phẩm', one.name, one.count, one.amount]),
      ['Tổng', 'Tất cả', report.orderCount, report.total],
    ];
    send(res, 'doanh-thu', asCsv(['Loại', 'Tên', 'Số lượng', 'Thành tiền (đồng)'], rows));
  }

  @Roles(Role.MANAGER)
  @Get('ai-cost')
  aiCost(@Query() query: PeriodDto) {
    return this.service.aiCost(periodOf(query));
  }

  @Roles(Role.MANAGER)
  @Get('ai-cost.csv')
  async aiCostCsv(@Query() query: PeriodDto, @Res() res: Response): Promise<void> {
    const report = await this.service.aiCost(periodOf(query));
    const rows = report.rows.map((one) => [one.kind, one.count, one.cost]);
    rows.push(['Tổng', '', report.total]);
    send(res, 'chi-phi-ai', asCsv(['Loại lượt dùng', 'Số lượt', 'Chi phí (đồng)'], rows));
  }

  @Roles(Role.MANAGER)
  @Get('progress')
  progress(@Query() query: PeriodDto) {
    return this.service.progress(periodOf(query));
  }

  @Roles(Role.MANAGER)
  @Get('progress.csv')
  async progressCsv(@Query() query: PeriodDto, @Res() res: Response): Promise<void> {
    const report = await this.service.progress(periodOf(query));
    const rows: unknown[][] = report.byStatus.map((one) => ['Trạng thái', one.status, one.count]);
    for (const one of report.late) {
      rows.push(['Trễ hạn', one.orderCode, one.status, one.estimatedDelivery]);
    }
    send(res, 'tien-do-san-xuat', asCsv(['Loại', 'Tên', 'Số đơn', 'Ngày giao dự kiến'], rows));
  }
}

/**
 * Doc khoang thoi gian tu dia chi.
 *
 * Bo trong thi lay ba muoi ngay gan nhat, de mot lan mo bao cao khong bao gio
 * quet toan bo lich su cua he thong.
 */
function periodOf(query: PeriodDto): Period {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - DEFAULT_DAYS * DAY_MS);
  if (from.getTime() > to.getTime()) {
    throw new BadRequestException('Ngay bat dau phai truoc ngay ket thuc');
  }
  return { from, to };
}

/** Gui mot tep CSV ve trinh duyet duoi dang tep tai xuong. */
function send(res: Response, name: string, body: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(body);
}
