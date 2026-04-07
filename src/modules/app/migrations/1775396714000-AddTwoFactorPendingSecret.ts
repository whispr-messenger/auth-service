import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwoFactorPendingSecret1775396714000 implements MigrationInterface {
	name = 'AddTwoFactorPendingSecret1775396714000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE auth.users_auth
			ADD COLUMN IF NOT EXISTS two_factor_pending_secret VARCHAR(255) NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE auth.users_auth
			DROP COLUMN IF EXISTS two_factor_pending_secret
		`);
	}
}
