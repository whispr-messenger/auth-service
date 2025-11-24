import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiResponseOptions,
} from '@nestjs/swagger';
import { AppService } from './app.service';

const swaggerApiResponse: ApiResponseOptions = {
  description: 'Returns a welcome message',
  schema: {
    type: 'string',
    example: 'Hello World!',
  },
};

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get welcome message' })
  @ApiResponse(swaggerApiResponse)
  getHello(): string {
    return this.appService.getHello();
  }
}
