import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuctionBidMode1743292800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."auctions_bid_mode_enum" AS ENUM('free', 'fixed_increment')`,
    );

    await queryRunner.query(
      `ALTER TABLE "auctions"
        ADD COLUMN "bid_mode" "public"."auctions_bid_mode_enum" NOT NULL DEFAULT 'free',
        ADD COLUMN "bid_increment" numeric(12,2) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auctions"
        DROP COLUMN "bid_increment",
        DROP COLUMN "bid_mode"`,
    );

    await queryRunner.query(`DROP TYPE "public"."auctions_bid_mode_enum"`);
  }
}
