import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserAuth } from '../entities/user-auth.entity';
import { Device } from '../entities/device.entity';
import { PreKey } from '../entities/prekey.entity';
import { SignedPreKey } from '../entities/signed-prekey.entity';
import { IdentityKey } from '../entities/identity-key.entity';
import { BackupCode } from '../entities/backup-code.entity';
import { LoginHistory } from '../entities/login-history.entity';

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'auth_user'),
  password: configService.get('DB_PASSWORD', 'auth_password'),
  database: configService.get('DB_DATABASE', 'auth_service'),
  entities: [
    UserAuth,
    Device,
    PreKey,
    SignedPreKey,
    IdentityKey,
    BackupCode,
    LoginHistory,
  ],
  migrations: [__dirname + '/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});
