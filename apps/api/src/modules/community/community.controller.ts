import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CommunityService } from './community.service';
import { FeedQueryDto, WriteCommentDto, WritePostDto } from './dto/community.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';

const RESOURCE = 'CommunityPost';
const ONE_POST = 'posts/:id';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly service: CommunityService,
    private readonly audit: AuditService,
  ) {}

  /** The feed is readable signed out. A session only adds the viewer own reactions. */
  @Public()
  @Get('posts')
  feed(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto) {
    return this.service.feed(user?.userId ?? null, query);
  }

  /** Counts per topic for the discover screen. Declared before the parameterised path. */
  @Public()
  @Get('topics')
  topics() {
    return this.service.topicCounts();
  }

  @Public()
  @Get(ONE_POST)
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.detail(id, user?.userId ?? null);
  }

  @Public()
  @Get('posts/:id/comments')
  listComment(@Param('id') id: string) {
    return this.service.listComment(id);
  }

  /**
   * Serves a post photo through a permission-checked path rather than exposing
   * the storage folder.
   */
  @Public()
  @Get('posts/:id/photos/:fileName')
  async readPhoto(
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const data = await this.service.readPhoto(id, fileName);
    res.setHeader('Content-Type', fileName.endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.send(data);
  }

  @HttpPost('posts')
  async create(@Body() dto: WritePostDto, @CurrentUser() user: AuthUser) {
    const post = await this.service.create(user.userId, dto);
    await this.audit.write({
      actor: user.userId,
      action: 'CREATE_COMMUNITY_POST',
      resourceType: RESOURCE,
      resourceId: post._id.toString(),
      after: { topic: post.topic, title: post.title },
    });
    return post;
  }

  @Patch(ONE_POST)
  edit(@Param('id') id: string, @Body() dto: WritePostDto, @CurrentUser() user: AuthUser) {
    return this.service.edit(id, user.userId, dto);
  }

  @HttpPost('posts/:id/photos')
  @UseInterceptors(FileInterceptor('file'))
  addPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addPhoto(id, user.userId, file);
  }

  @Delete(ONE_POST)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const post = await this.service.hide(id, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'HIDE_COMMUNITY_POST',
      resourceType: RESOURCE,
      resourceId: post._id.toString(),
    });
    return { ok: true };
  }

  /** Internal staff can take down a post that breaks the house rules. */
  @Roles(Role.MANAGER, Role.ADMIN)
  @Delete('posts/:id/moderate')
  async moderate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const post = await this.service.hide(id, null);
    await this.audit.write({
      actor: user.userId,
      action: 'MODERATE_COMMUNITY_POST',
      resourceType: RESOURCE,
      resourceId: post._id.toString(),
    });
    return { ok: true };
  }

  @HttpPost('posts/:id/comments')
  comment(@Param('id') id: string, @Body() dto: WriteCommentDto, @CurrentUser() user: AuthUser) {
    return this.service.comment(id, user.userId, dto);
  }

  @Delete('comments/:id')
  async removeComment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.service.hideComment(id, user.userId);
    return { ok: true };
  }

  @HttpPost('posts/:id/like')
  toggleLike(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.toggleLike(id, user.userId);
  }

  @HttpPost('posts/:id/save')
  toggleSave(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.toggleSave(id, user.userId);
  }

  @HttpPost('users/:id/follow')
  toggleFollow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.toggleFollow(id, user.userId);
  }

  @Public()
  @Get('users/:id')
  profile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.profile(id, user?.userId ?? null);
  }

  @Public()
  @Get('users/:id/posts')
  postsOf(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.postsOf(id, user?.userId ?? null);
  }
}
