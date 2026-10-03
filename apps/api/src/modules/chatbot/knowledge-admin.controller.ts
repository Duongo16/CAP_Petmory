import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';
import { KnowledgeTopic } from './schemas/assistant-knowledge.schema';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';

const RESOURCE = 'AssistantKnowledge';

/** Ban gon cua mot muc hoi dap de ghi vao nhat ky he thong. */
function shortOf(one: { code: string; question: string; answer: string; enabled: boolean; link: string }) {
  return { code: one.code, question: one.question, answer: one.answer, link: one.link, enabled: one.enabled };
}

/**
 * Kho tri thuc cua tro ly, phia nhom Quan ly.
 *
 * Moi lan them, sua hay an deu ghi nhat ky kem noi dung truoc va sau, vi day
 * la loi cua hang noi voi khach.
 */
@Roles(Role.MANAGER)
@Controller('admin/assistant/knowledge')
export class KnowledgeAdminController {
  constructor(
    private readonly service: KnowledgeService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('topic') topic?: KnowledgeTopic, @Query('keyword') keyword?: string) {
    const wanted = topic && Object.values(KnowledgeTopic).includes(topic) ? topic : undefined;
    return this.service.list(wanted, keyword);
  }

  @Post()
  async create(@Body() dto: KnowledgeDto, @CurrentUser() user: AuthUser) {
    const made = await this.service.create(dto);
    await this.audit.write({
      actor: user.userId,
      action: 'ASSISTANT_KNOWLEDGE_CREATED',
      resourceType: RESOURCE,
      resourceId: made.code,
      after: shortOf(made),
    });
    return made;
  }

  @Patch(':code')
  async update(@Param('code') code: string, @Body() dto: UpdateKnowledgeDto, @CurrentUser() user: AuthUser) {
    const before = (await this.service.list(undefined, undefined)).find((one) => one.code === code.toUpperCase());
    const after = await this.service.update(code, dto);
    await this.audit.write({
      actor: user.userId,
      action: 'ASSISTANT_KNOWLEDGE_UPDATED',
      resourceType: RESOURCE,
      resourceId: after.code,
      before: before ? shortOf(before) : undefined,
      after: shortOf(after),
    });
    return after;
  }

  @Delete(':code')
  async hide(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    const after = await this.service.hide(code);
    await this.audit.write({
      actor: user.userId,
      action: 'ASSISTANT_KNOWLEDGE_HIDDEN',
      resourceType: RESOURCE,
      resourceId: after.code,
    });
    return after;
  }
}
