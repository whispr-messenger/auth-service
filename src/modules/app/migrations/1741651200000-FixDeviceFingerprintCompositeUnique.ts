import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDeviceFingerprintCompositeUnique1741651200000 implements MigrationInterface {
	name = 'FixDeviceFingerprintCompositeUnique1741651200000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Drop the old global unique constraint on device_fingerprint alone
		await queryRunner.query(`
      ALTER TABLE "devices"
      DROP CONSTRAINT IF EXISTS "UQ_b7c1a1b1d1eff0d845ae768113f"
    `);

		await queryRunner.query(`
      ALTER TABLE "devices"
      DROP CONSTRAINT IF EXISTS "UQ_devices_device_fingerprint"
    `);

		// Add composite unique constraint: a fingerprint must be unique per user
		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_devices_userId_deviceFingerprint'
        ) THEN
          ALTER TABLE "devices"
          ADD CONSTRAINT "UQ_devices_userId_deviceFingerprint"
          UNIQUE ("user_id", "device_fingerprint");
        END IF;
      END
      $$
    `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
      ALTER TABLE "devices"
      DROP CONSTRAINT IF EXISTS "UQ_devices_userId_deviceFingerprint"
    `);

		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_devices_device_fingerprint'
        ) THEN
          ALTER TABLE "devices"
          ADD CONSTRAINT "UQ_devices_device_fingerprint" UNIQUE ("device_fingerprint");
        END IF;
      END
      $$
    `);
	}
}
