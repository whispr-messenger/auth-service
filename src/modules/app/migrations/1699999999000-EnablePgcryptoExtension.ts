import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgcryptoExtension1699999999000 implements MigrationInterface {
	name = 'EnablePgcryptoExtension1699999999000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
	}
}
