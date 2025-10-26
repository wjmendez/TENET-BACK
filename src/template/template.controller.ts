import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { TemplateService } from './template.service.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';


@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @ApiBody({ type: CreateTemplateDto })
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templateService.remove(id);
  }
}
