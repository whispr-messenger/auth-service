import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingDeviceColumns1743854400000 implements MigrationInterface {
	name = 'AddMissingDeviceColumns1743854400000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "model" VARCHAR(100)
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "os_version" VARCHAR(50)
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "app_version" VARCHAR(20)
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "apns_token" VARCHAR(255)
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true
    `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "auth"."devices" DROP COLUMN IF EXISTS "is_active"`);
		await queryRunner.query(`ALTER TABLE "auth"."devices" DROP COLUMN IF EXISTS "apns_token"`);
		await queryRunner.query(`ALTER TABLE "auth"."devices" DROP COLUMN IF EXISTS "app_version"`);
		await queryRunner.query(`ALTER TABLE "auth"."devices" DROP COLUMN IF EXISTS "os_version"`);
		await queryRunner.query(`ALTER TABLE "auth"."devices" DROP COLUMN IF EXISTS "model"`);
	}
}
