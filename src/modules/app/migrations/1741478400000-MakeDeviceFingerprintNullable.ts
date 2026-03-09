import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeDeviceFingerprintNullable1741478400000 implements MigrationInterface {
	name = 'MakeDeviceFingerprintNullable1741478400000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
      ALTER TABLE "devices" ALTER COLUMN "device_fingerprint" DROP NOT NULL
    `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
      ALTER TABLE "devices" ALTER COLUMN "device_fingerprint" SET NOT NULL
    `);
	}
}
