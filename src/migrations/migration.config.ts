import { DataSource } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { UserAuth } from '../modules/two-factor-authentication/user-auth.entity'
import { Device } from '../modules/devices/device.entity'
import { PreKey } from '../modules/authentication/entities/prekey.entity'
import { SignedPreKey } from '../modules/authentication/entities/signed-prekey.entity'
import { IdentityKey } from '../modules/authentication/entities/identity-key.entity'
import { BackupCode } from '../modules/authentication/entities/backup-code.entity'
import { LoginHistory } from '../modules/authentication/entities/login-history.entity'

const configService = new ConfigService()

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
})
