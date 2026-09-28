import { Body, Controller, Get, Patch } from '@nestjs/common';
import { BusinessConfigService } from './business-config.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';
import { UpdateConfigDto } from './dto/business-config.dto';

const RESOURCE_TYPE = 'BusinessConfig';

@Controller('settings')
export class BusinessConfigController {
  constructor(
    private readonly service: BusinessConfigService,
    private readonly audit: AuditService,
  ) {}

  @Roles(Role.MANAGER, Role.ADMIN)
  @Get()
  get() {
    return this.service.get();
  }

  /** Only the Manager group may change business settings. */
  @Roles(Role.MANAGER)
  @Patch()
  async update(@Body() body: UpdateConfigDto, @CurrentUser() user: AuthUser) {
    const before = await this.service.get();
    const after = await this.service.update(body, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'CONFIG_UPDATED',
      resourceType: RESOURCE_TYPE,
      resourceId: before.key,
      before: before.toObject(),
      after: after.toObject(),
    });
    return after;
  }
}
