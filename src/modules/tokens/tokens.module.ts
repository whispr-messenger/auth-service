import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokensController } from './controllers/tokens.controller';
import { TokensService } from './services/tokens.service';
import { JwtAuthGuard } from './guards';

@Module({
	providers: [TokensService, JwtAuthGuard],
	controllers: [TokensController],
	imports: [JwtModule],
	exports: [TokensService, JwtModule, JwtAuthGuard],
})
export class TokensModule {}
