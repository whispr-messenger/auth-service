import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceFingerprintNotNull1741564800000 implements MigrationInterface {
	name = 'AddDeviceFingerprintNotNull1741564800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Revert the nullable migration: restore NOT NULL constraint.
		// Use ADD COLUMN IF NOT EXISTS with a temporary default to cover any environment
		// where the column was dropped, then enforce NOT NULL and add the UNIQUE constraint.
		await queryRunner.query(`
      ALTER TABLE "auth"."devices"
      ADD COLUMN IF NOT EXISTS "device_fingerprint" VARCHAR(255) NOT NULL DEFAULT gen_random_uuid()
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices" ALTER COLUMN "device_fingerprint" DROP DEFAULT
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices" ALTER COLUMN "device_fingerprint" SET NOT NULL
    `);

		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_devices_device_fingerprint'
        ) THEN
          ALTER TABLE "auth"."devices"
          ADD CONSTRAINT "UQ_devices_device_fingerprint" UNIQUE ("device_fingerprint");
        END IF;
      END
      $$
    `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
      ALTER TABLE "auth"."devices" DROP CONSTRAINT IF EXISTS "UQ_devices_device_fingerprint"
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."devices" DROP COLUMN IF EXISTS "device_fingerprint"
    `);
	}
}
