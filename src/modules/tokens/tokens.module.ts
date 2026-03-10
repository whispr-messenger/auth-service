import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleAsyncOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokensController } from './controllers/tokens.controller';
import { TokensService } from './services/tokens.service';
import { JwtAuthGuard } from './guards';
import { jwtModuleOptionsFactory } from './config/jwt.config';

const jwtModuleAsyncOptions: JwtModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: jwtModuleOptionsFactory,
	inject: [ConfigService],
};

@Module({
	providers: [TokensService, JwtAuthGuard],
	controllers: [TokensController],
	imports: [JwtModule.registerAsync(jwtModuleAsyncOptions)],
	exports: [TokensService, JwtModule, JwtAuthGuard],
})
export class TokensModule {}
