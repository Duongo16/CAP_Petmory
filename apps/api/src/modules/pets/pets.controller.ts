import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('pets')
export class PetsController {
  constructor(private readonly service: PetsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOwned(id, user.userId);
  }

  @Post()
  create(@Body() dto: CreatePetDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePetDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  hide(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hide(id, user.userId);
  }
}
