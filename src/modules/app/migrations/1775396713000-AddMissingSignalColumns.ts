import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingSignalColumns1775396713000 implements MigrationInterface {
	name = 'AddMissingSignalColumns1775396713000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// --- signed_prekeys: add expires_at ---
		// Add as nullable first so the column can be created on a non-empty table,
		// then backfill existing rows with created_at + 7 days (the standard key
		// lifetime used by the application), and enforce NOT NULL.
		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP
    `);

		await queryRunner.query(`
      UPDATE "auth"."signed_prekeys"
      SET "expires_at" = COALESCE("created_at", NOW()) + INTERVAL '7 days'
      WHERE "expires_at" IS NULL
    `);

		await queryRunner.query(`
      ALTER TABLE "auth"."signed_prekeys"
      ALTER COLUMN "expires_at" SET NOT NULL
    `);

		// --- signed_prekeys: deduplicate before adding unique constraint ---
		// Keep the most recently created row per (user_id, device_id, key_id) tuple.
		await queryRunner.query(`
      DELETE FROM "auth"."signed_prekeys" spk1
      USING "auth"."signed_prekeys" spk2
      WHERE spk1.user_id  = spk2.user_id
        AND spk1.device_id = spk2.device_id
        AND spk1.key_id    = spk2.key_id
        AND spk1.created_at < spk2.created_at
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

		// --- prekeys: deduplicate before adding unique constraint ---
		// Keep the most recently created row per (user_id, device_id, key_id) tuple.
		await queryRunner.query(`
      DELETE FROM "auth"."prekeys" pk1
      USING "auth"."prekeys" pk2
      WHERE pk1.user_id   = pk2.user_id
        AND pk1.device_id  = pk2.device_id
        AND pk1.key_id     = pk2.key_id
        AND pk1.created_at < pk2.created_at
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
			'Irreversible migration: AddMissingSignalColumns1775396713000 uses IF NOT EXISTS guards in up(), so rollback cannot safely determine whether columns, constraints, or indexes existed before this migration.'
		);
	}
}
