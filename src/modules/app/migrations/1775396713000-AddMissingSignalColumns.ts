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
		// Use ROW_NUMBER with (created_at DESC, id DESC) as a deterministic tie-breaker
		// to handle duplicates that share the same created_at timestamp.
		await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, device_id, key_id
            ORDER BY created_at DESC, id DESC
          ) AS row_num
        FROM "auth"."signed_prekeys"
      )
      DELETE FROM "auth"."signed_prekeys"
      WHERE id IN (SELECT id FROM ranked WHERE row_num > 1)
    `);

		// --- signed_prekeys: add unique constraint (user_id, device_id, key_id) ---
		// Guard by column set rather than constraint name to avoid creating a
		// duplicate constraint if one already exists under a different name.
		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'auth'
            AND c.relname = 'signed_prekeys'
            AND i.indisunique = true
            AND (
              SELECT array_agg(a.attname ORDER BY a.attnum)
              FROM pg_attribute a
              WHERE a.attrelid = i.indrelid
                AND a.attnum = ANY(i.indkey)
            ) = ARRAY['user_id', 'device_id', 'key_id']
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
		// Use ROW_NUMBER with (created_at DESC, id DESC) as a deterministic tie-breaker.
		await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, device_id, key_id
            ORDER BY created_at DESC, id DESC
          ) AS row_num
        FROM "auth"."prekeys"
      )
      DELETE FROM "auth"."prekeys"
      WHERE id IN (SELECT id FROM ranked WHERE row_num > 1)
    `);

		// --- prekeys: add unique constraint (user_id, device_id, key_id) ---
		// Guard by column set rather than constraint name.
		await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'auth'
            AND c.relname = 'prekeys'
            AND i.indisunique = true
            AND (
              SELECT array_agg(a.attname ORDER BY a.attnum)
              FROM pg_attribute a
              WHERE a.attrelid = i.indrelid
                AND a.attnum = ANY(i.indkey)
            ) = ARRAY['user_id', 'device_id', 'key_id']
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
