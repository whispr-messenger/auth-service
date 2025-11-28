import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateInitialTables1700000000000 implements MigrationInterface {
    name = 'CreateInitialTables1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE "users_auth" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "phone_number" character varying(20) NOT NULL,
        "two_factor_secret" character varying(255),
        "two_factor_enabled" boolean NOT NULL DEFAULT false,
        "last_authenticated_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_auth_phone_number" UNIQUE ("phone_number"),
        CONSTRAINT "PK_users_auth" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_name" character varying(100) NOT NULL,
        "device_type" character varying(20) NOT NULL,
        "fcm_token" character varying(255),
        "public_key" text NOT NULL,
        "last_active" TIMESTAMP NOT NULL DEFAULT now(),
        "ip_address" character varying(45),
        "is_verified" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      CREATE TABLE "prekeys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "key_id" integer NOT NULL,
        "public_key" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prekeys" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      CREATE TABLE "signed_prekeys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "key_id" integer NOT NULL,
        "public_key" text NOT NULL,
        "signature" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_signed_prekeys" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      CREATE TABLE "identity_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "public_key" text NOT NULL,
        "private_key_encrypted" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_identity_keys_user_id" UNIQUE ("user_id"),
        CONSTRAINT "PK_identity_keys" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      CREATE TABLE "backup_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "code_hash" character varying(255) NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "used_at" TIMESTAMP,
        CONSTRAINT "PK_backup_codes" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      CREATE TABLE "login_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_id" uuid,
        "ip_address" character varying(45) NOT NULL,
        "user_agent" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "status" character varying(20) NOT NULL,
        CONSTRAINT "PK_login_history" PRIMARY KEY ("id")
      )
    `)

        await queryRunner.query(`
      ALTER TABLE "devices" ADD CONSTRAINT "FK_devices_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users_auth"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "prekeys" ADD CONSTRAINT "FK_prekeys_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users_auth"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "prekeys" ADD CONSTRAINT "FK_prekeys_device_id"
      FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "signed_prekeys" ADD CONSTRAINT "FK_signed_prekeys_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users_auth"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "signed_prekeys" ADD CONSTRAINT "FK_signed_prekeys_device_id"
      FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "identity_keys" ADD CONSTRAINT "FK_identity_keys_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users_auth"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "backup_codes" ADD CONSTRAINT "FK_backup_codes_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users_auth"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "login_history" ADD CONSTRAINT "FK_login_history_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users_auth"("id") ON DELETE CASCADE
    `)

        await queryRunner.query(`
      ALTER TABLE "login_history" ADD CONSTRAINT "FK_login_history_device_id"
      FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL
    `)

        await queryRunner.query(`
      CREATE INDEX "IDX_users_auth_phone_number" ON "users_auth" ("phone_number")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_users_auth_created_at" ON "users_auth" ("created_at")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_devices_user_id" ON "devices" ("user_id")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_devices_last_active" ON "devices" ("last_active")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_backup_codes_user_id" ON "backup_codes" ("user_id")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_login_history_user_id" ON "login_history" ("user_id")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_login_history_device_id" ON "login_history" ("device_id")
    `)
        await queryRunner.query(`
      CREATE INDEX "IDX_login_history_created_at" ON "login_history" ("created_at")
    `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_login_history_created_at"`)
        await queryRunner.query(`DROP INDEX "IDX_login_history_device_id"`)
        await queryRunner.query(`DROP INDEX "IDX_login_history_user_id"`)
        await queryRunner.query(`DROP INDEX "IDX_backup_codes_user_id"`)
        await queryRunner.query(`DROP INDEX "IDX_devices_last_active"`)
        await queryRunner.query(`DROP INDEX "IDX_devices_user_id"`)
        await queryRunner.query(`DROP INDEX "IDX_users_auth_created_at"`)
        await queryRunner.query(`DROP INDEX "IDX_users_auth_phone_number"`)
        await queryRunner.query(`
      ALTER TABLE "login_history" DROP CONSTRAINT "FK_login_history_device_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "login_history" DROP CONSTRAINT "FK_login_history_user_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "backup_codes" DROP CONSTRAINT "FK_backup_codes_user_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "identity_keys" DROP CONSTRAINT "FK_identity_keys_user_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "signed_prekeys" DROP CONSTRAINT "FK_signed_prekeys_device_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "signed_prekeys" DROP CONSTRAINT "FK_signed_prekeys_user_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "prekeys" DROP CONSTRAINT "FK_prekeys_device_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "prekeys" DROP CONSTRAINT "FK_prekeys_user_id"
    `)
        await queryRunner.query(`
      ALTER TABLE "devices" DROP CONSTRAINT "FK_devices_user_id"
    `)
        await queryRunner.query(`DROP TABLE "login_history"`)
        await queryRunner.query(`DROP TABLE "backup_codes"`)
        await queryRunner.query(`DROP TABLE "identity_keys"`)
        await queryRunner.query(`DROP TABLE "signed_prekeys"`)
        await queryRunner.query(`DROP TABLE "prekeys"`)
        await queryRunner.query(`DROP TABLE "devices"`)
        await queryRunner.query(`DROP TABLE "users_auth"`)
    }
}
