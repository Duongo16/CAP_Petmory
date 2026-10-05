import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';
import { Role } from '../../common/constants/roles';
import { MSG } from '../../common/constants/messages';
import { AccountQueryDto } from './dto/account.dto';
import { AuditService } from '../../common/audit.service';

/** Loai tai nguyen ghi trong nhat ky thao tac. */
const RESOURCE = 'User';

/** Bao nhieu tai khoan tren mot trang. */
const PAGE_SIZE = 20;

/** Loi bao khi mot nguoi tu doi nhom quyen hoac tu tat tai khoan cua minh. */
const SELF_GUARD = 'Khong tu doi quyen hoac tu tat tai khoan cua chinh minh';

/** Loi bao khi dinh bo di nguoi quan tri cuoi cung. */
const LAST_MANAGER = 'Phai con it nhat mot tai khoan nhom Quan ly dang bat';

/**
 * Quan ly tai khoan, danh cho nhom Quan tri vien.
 *
 * Nhom nay khong cham vao don hang, tien hay danh muc. Doi lai, day la nhom
 * duy nhat tao duoc tai khoan, doi duoc nhom quyen va tat duoc mot tai khoan.
 *
 * Hai rang buoc duoc giu o day chu khong o giao dien, vi giao dien chi la mot
 * trong nhieu duong goi toi: khong ai tu doi quyen cua chinh minh, va khong
 * bao gio het sach nguoi quan tri.
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** Danh sach tai khoan, tim theo ten hoac dia chi thu. */
  async list(query: AccountQueryDto) {
    const where: Record<string, unknown> = {};
    const word = query.keyword?.trim();
    if (word) {
      const shape = new RegExp(escapeWord(word), 'i');
      where['$or'] = [{ fullName: shape }, { email: shape }];
    }
    if (query.role) {
      where['roles'] = query.role;
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const [rows, total] = await Promise.all([
      this.model
        .find(where)
        .select('email fullName phone roles active lastLoginAt petProfileLimit createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      this.model.countDocuments(where).exec(),
    ]);

    return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }

  /** So tai khoan theo tung nhom quyen, de hien len dau trang. */
  async countByRole(): Promise<Record<string, number>> {
    const rows = await this.model.aggregate<{ _id: string; count: number }>([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } },
    ]);
    const out: Record<string, number> = {};
    for (const one of Object.values(Role)) {
      out[one] = 0;
    }
    for (const one of rows) {
      out[one._id] = one.count;
    }
    return out;
  }

  async detail(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const one = await this.model
      .findById(id)
      .select('email fullName phone roles active lastLoginAt petProfileLimit createdAt')
      .exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  /** Tao mot tai khoan moi, mang dung mot nhom quyen. */
  async create(
    input: { email: string; password: string; fullName: string; phone?: string; role: string },
    actor: string,
  ): Promise<UserDocument> {
    const made = await this.users.createNext({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      phone: input.phone,
      roles: [input.role as Role],
    });
    await this.audit.write({
      actor,
      action: 'ACCOUNT_CREATED',
      resourceType: RESOURCE,
      resourceId: made._id.toString(),
      after: { email: made.email, role: input.role },
    });
    return made;
  }

  /**
   * Doi nhom quyen cua mot tai khoan.
   *
   * Doi quyen xong thi cac ma dang nhap cu cua nguoi do bi bo, vi ma cu mang
   * theo nhom quyen cu va se con dung duoc cho den luc het han.
   */
  async changeRole(id: string, role: string, actor: string): Promise<UserDocument> {
    const one = await this.detail(id);
    if (one._id.toString() === actor) {
      throw new BadRequestException(SELF_GUARD);
    }
    if (one.roles.includes(Role.MANAGER) && role !== Role.MANAGER) {
      await this.keepOneManager(one._id.toString());
    }
    const before = [...one.roles];
    one.roles = [role as Role];
    await one.save();
    await this.users.bumpTokenEpoch(id);
    await this.audit.write({
      actor,
      action: 'ACCOUNT_ROLE_CHANGED',
      resourceType: RESOURCE,
      resourceId: id,
      before: { roles: before },
      after: { roles: one.roles },
    });
    return one;
  }

  /** Bat hoac tat mot tai khoan. Tat thi cac ma dang nhap cu cung bi bo. */
  async setActive(id: string, active: boolean, actor: string): Promise<UserDocument> {
    const one = await this.detail(id);
    if (one._id.toString() === actor) {
      throw new BadRequestException(SELF_GUARD);
    }
    if (!active && one.roles.includes(Role.MANAGER)) {
      await this.keepOneManager(one._id.toString());
    }
    const before = one.active;
    one.active = active;
    await one.save();
    if (!active) {
      await this.users.bumpTokenEpoch(id);
    }
    await this.audit.write({
      actor,
      action: 'ACCOUNT_ACTIVE_CHANGED',
      resourceType: RESOURCE,
      resourceId: id,
      before: { active: before },
      after: { active },
    });
    return one;
  }

  /**
   * Dat lai mat khau cho mot tai khoan.
   *
   * Cac ma dang nhap cu bi bo ngay, de nguoi dang cam ma cu khong tiep tuc
   * dung duoc sau khi mat khau da doi.
   */
  async resetPassword(id: string, password: string, actor: string): Promise<{ done: boolean }> {
    await this.detail(id);
    await this.users.setPassword(id, password);
    await this.users.bumpTokenEpoch(id);
    // Chi ghi la da dat lai, khong bao gio ghi mat khau.
    await this.audit.write({ actor, action: 'ACCOUNT_PASSWORD_RESET', resourceType: RESOURCE, resourceId: id });
    return { done: true };
  }

  /** Dat rieng gioi han so ho so thu cung. De trong la quay ve muc chung. */
  async setPetLimit(id: string, limit: number | undefined, actor: string): Promise<UserDocument> {
    const one = await this.detail(id);
    const before = one.petProfileLimit ?? null;
    one.petProfileLimit = limit ?? null;
    const saved = await one.save();
    await this.audit.write({
      actor,
      action: 'ACCOUNT_PET_LIMIT_CHANGED',
      resourceType: RESOURCE,
      resourceId: id,
      before: { petProfileLimit: before },
      after: { petProfileLimit: saved.petProfileLimit ?? null },
    });
    return saved;
  }

  /**
   * Khong cho bo di nguoi quan ly cuoi cung.
   *
   * Het sach nguoi quan ly dang bat thi khong con ai tao lai duoc tai khoan
   * nao nua, va he thong tu khoa chinh minh.
   */
  private async keepOneManager(exceptId: string): Promise<void> {
    const left = await this.model
      .countDocuments({ roles: Role.MANAGER, active: true, _id: { $ne: exceptId } })
      .exec();
    if (left === 0) {
      throw new BadRequestException(LAST_MANAGER);
    }
  }
}

/** Bo y nghia dac biet cua cac ky tu tim kiem, de nguoi dung go gi cung an toan. */
function escapeWord(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
