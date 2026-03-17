import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuctionBiddingFields1773200000000 implements MigrationInterface {
  name = 'AuctionBiddingFields1773200000000';
  transaction = false; // ADD VALUE on enums cannot be used in the same transaction

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values
    await queryRunner.query(
      `ALTER TYPE "public"."auctions_status_enum" ADD VALUE IF NOT EXISTS 'created'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."auctions_status_enum" ADD VALUE IF NOT EXISTS 'closed'`,
    );

    // Rename price → initialPrice
    await queryRunner.query(
      `ALTER TABLE "auctions" RENAME COLUMN "price" TO "initialPrice"`,
    );

    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD "currentPrice" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD "durationMinutes" integer NOT NULL DEFAULT 60`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD "startedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD "endAt" TIMESTAMP WITH TIME ZONE`,
    );

    // Change default status from 'active' to 'created'
    await queryRunner.query(
      `ALTER TABLE "auctions" ALTER COLUMN "status" SET DEFAULT 'created'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auctions" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "endAt"`);
    await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "startedAt"`);
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN "durationMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN "currentPrice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" RENAME COLUMN "initialPrice" TO "price"`,
    );
  }
}
