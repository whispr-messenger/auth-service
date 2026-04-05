import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingSignalColumns1743940800000 implements MigrationInterface {
	name = 'AddMissingSignalColumns1743940800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// --- signed_prekeys: add expires_at ---
		// Add as nullable first so the column can be created on a non-empty table,
		// then backfill existing rows and enforce NOT NULL.
		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP
    `);

		await queryRunner.query(`
      UPDATE "auth"."signed_prekeys"
      SET "expires_at" = COALESCE("created_at", NOW())
      WHERE "expires_at" IS NULL
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      ALTER COLUMN "expires_at" SET NOT NULL
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

	public async down(_queryRunner: QueryRunner): Promise<void> {
		throw new Error(
			'Irreversible migration: AddMissingSignalColumns1743940800000 uses IF NOT EXISTS guards in up(), so rollback cannot safely determine whether columns, constraints, or indexes existed before this migration.'
		);
	}
}
