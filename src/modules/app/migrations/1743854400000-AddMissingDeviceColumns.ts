import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingDeviceColumns1743854400000 implements MigrationInterface {
	name = 'AddMissingDeviceColumns1743854400000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "model" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "os_version" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "app_version" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "apns_token" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true
    `);
	}

	public async down(_queryRunner: QueryRunner): Promise<void> {
		throw new Error(
			'Migration AddMissingDeviceColumns1743854400000 is irreversible: the added columns may have existed before this migration ran, so rolling back could drop pre-existing columns and data.'
		);
	}
}
