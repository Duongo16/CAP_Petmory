import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { WriteReviewDto } from './dto/review.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';

const RESOURCE = 'ProductReview';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly service: ReviewsService,
    private readonly audit: AuditService,
  ) {}

  /** Anyone can read the ratings on a product page, signed in or not. */
  @Public()
  @Get('product/:code')
  listForProduct(@Param('code') code: string, @Query('limit') limit?: string) {
    return this.service.listForProduct(code, Number(limit) || 20);
  }

  /** What the signed-in customer is still entitled to rate. */
  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.service.pendingForCustomer(user.userId);
  }

  @Post()
  async write(@Body() dto: WriteReviewDto, @CurrentUser() user: AuthUser) {
    const review = await this.service.write(user.userId, dto);
    await this.audit.write({
      actor: user.userId,
      action: 'WRITE_PRODUCT_REVIEW',
      resourceType: RESOURCE,
      resourceId: review._id.toString(),
      after: { productTypeCode: review.productTypeCode, rating: review.rating },
    });
    return review;
  }

  /** A customer may withdraw their own review. Ownership is checked in the query. */
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const review = await this.service.hide(id, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'HIDE_PRODUCT_REVIEW',
      resourceType: RESOURCE,
      resourceId: review._id.toString(),
    });
    return { ok: true };
  }

  /** Internal staff can take down a review that breaks the house rules. */
  @Roles(Role.MANAGER)
  @Delete(':id/moderate')
  async moderate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const review = await this.service.hide(id, null);
    await this.audit.write({
      actor: user.userId,
      action: 'MODERATE_PRODUCT_REVIEW',
      resourceType: RESOURCE,
      resourceId: review._id.toString(),
    });
    return { ok: true };
  }
}
