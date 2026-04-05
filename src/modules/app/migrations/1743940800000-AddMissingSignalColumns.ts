import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingSignalColumns1743940800000 implements MigrationInterface {
	name = 'AddMissingSignalColumns1743940800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// --- signed_prekeys: add expires_at ---
		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP
    `);

		// --- signed_prekeys: add unique constraint (user_id, device_id, key_id) ---
		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_signed_prekeys_user_device_key'
            AND conrelid = '"auth"."signed_prekeys"'::regclass
        ) THEN
          ALTER TABLE "auth"."signed_prekeys"
          ADD CONSTRAINT "UQ_signed_prekeys_user_device_key"
          UNIQUE ("user_id", "device_id", "key_id");
        END IF;
      END
      $$
    `);

		// --- signed_prekeys: add composite index (user_id, device_id) ---
		await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_signed_prekeys_user_id_device_id"
      ON "auth"."signed_prekeys" ("user_id", "device_id")
    `);

		// --- prekeys: add is_one_time and is_used columns ---
		await queryRunner.query(`
      ALTER TABLE "auth"."prekeys"
      ADD COLUMN IF NOT EXISTS "is_one_time" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "is_used" BOOLEAN NOT NULL DEFAULT false
    `);

		// --- prekeys: add unique constraint (user_id, device_id, key_id) ---
		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_prekeys_user_device_key'
            AND conrelid = '"auth"."prekeys"'::regclass
        ) THEN
          ALTER TABLE "auth"."prekeys"
          ADD CONSTRAINT "UQ_prekeys_user_device_key"
          UNIQUE ("user_id", "device_id", "key_id");
        END IF;
      END
      $$
    `);

		// --- prekeys: add composite index (user_id, device_id) ---
		await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prekeys_user_id_device_id"
      ON "auth"."prekeys" ("user_id", "device_id")
    `);

		// --- prekeys: add partial index on (user_id, device_id, is_used) WHERE is_used = false ---
		await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prekeys_user_device_unused"
      ON "auth"."prekeys" ("user_id", "device_id", "is_used")
      WHERE "is_used" = false
    `);

		// --- identity_keys: add updated_at column ---
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// identity_keys
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      DROP COLUMN IF EXISTS "updated_at"
    `);

		// prekeys
		await queryRunner.query(`DROP INDEX IF EXISTS "auth"."IDX_prekeys_user_device_unused"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "auth"."IDX_prekeys_user_id_device_id"`);
		await queryRunner.query(`
      ALTER TABLE "auth"."prekeys"
      DROP CONSTRAINT IF EXISTS "UQ_prekeys_user_device_key"
    `);
		await queryRunner.query(`
      ALTER TABLE "auth"."prekeys"
      DROP COLUMN IF EXISTS "is_used",
      DROP COLUMN IF EXISTS "is_one_time"
    `);

		// signed_prekeys
		await queryRunner.query(`DROP INDEX IF EXISTS "auth"."IDX_signed_prekeys_user_id_device_id"`);
		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      DROP CONSTRAINT IF EXISTS "UQ_signed_prekeys_user_device_key"
    `);
		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      DROP COLUMN IF EXISTS "expires_at"
    `);
	}
}
