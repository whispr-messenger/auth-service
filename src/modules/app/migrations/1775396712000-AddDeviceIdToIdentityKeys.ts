import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceIdToIdentityKeys1775396712000 implements MigrationInterface {
	name = 'AddDeviceIdToIdentityKeys1775396712000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Step 1: Acquire exclusive lock to prevent race conditions
		await queryRunner.query(`
      LOCK TABLE "auth"."identity_keys" IN ACCESS EXCLUSIVE MODE
    `);

		// Step 2: Remove all existing identity_keys since they don't have device_id
		// TRUNCATE is faster than DELETE and generates less WAL
		// This is acceptable because identity keys are regenerated on next device registration
		await queryRunner.query(`
      TRUNCATE TABLE "auth"."identity_keys"
    `);

		// Step 3: Add device_id column to identity_keys table
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      ADD COLUMN "device_id" uuid NOT NULL
    `);

		// Step 4: Drop the old unique constraint on user_id only
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      DROP CONSTRAINT IF EXISTS "UQ_identity_keys_user_id"
    `);

		// Step 5: Create new unique constraint on user_id + device_id
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      ADD CONSTRAINT "UQ_identity_keys_user_id_device_id" UNIQUE ("user_id", "device_id")
    `);

		// Step 6: Add foreign key constraint to devices table
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      ADD CONSTRAINT "FK_identity_keys_device_id"
      FOREIGN KEY ("device_id") REFERENCES "auth"."devices"("id") ON DELETE CASCADE
    `);

		// Step 7: Create index for better query performance
		await queryRunner.query(`
      CREATE INDEX "IDX_identity_keys_device_id" ON "auth"."identity_keys" ("device_id")
    `);

		// Step 8: Remove the private_key_encrypted column as it's not used in the entity
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      DROP COLUMN IF EXISTS "private_key_encrypted"
    `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove index
		await queryRunner.query(`DROP INDEX IF EXISTS "auth"."IDX_identity_keys_device_id"`);

		// Remove foreign key
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      DROP CONSTRAINT IF EXISTS "FK_identity_keys_device_id"
    `);

		// Drop the composite unique constraint
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      DROP CONSTRAINT IF EXISTS "UQ_identity_keys_user_id_device_id"
    `);

		// Restore the old unique constraint
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      ADD CONSTRAINT "UQ_identity_keys_user_id" UNIQUE ("user_id")
    `);

		// Remove device_id column
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      DROP COLUMN "device_id"
    `);

		// Restore private_key_encrypted column
		await queryRunner.query(`
      ALTER TABLE "auth"."identity_keys"
      ADD COLUMN "private_key_encrypted" text
    `);
	}
}
