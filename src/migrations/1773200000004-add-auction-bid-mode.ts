import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuctionBidMode1773200000004 implements MigrationInterface {
  name = 'AddAuctionBidMode1773200000004';
  transaction = false; // CREATE TYPE cannot run inside a transaction in some PG versions

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."auctions_bid_mode_enum" AS ENUM('free', 'fixed_increment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "auctions"
        ADD COLUMN IF NOT EXISTS "bid_mode" "public"."auctions_bid_mode_enum" NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS "bid_increment" numeric(12,2) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auctions"
        DROP COLUMN IF EXISTS "bid_increment",
        DROP COLUMN IF EXISTS "bid_mode"`,
    );

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."auctions_bid_mode_enum"`,
    );
  }
}
