import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBidsTable1773200000002 implements MigrationInterface {
  name = 'CreateBidsTable1773200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bids" (
        "id" SERIAL NOT NULL,
        "auctionId" integer NOT NULL,
        "userId" integer NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bids" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bids_auction_created_at"
      ON "bids" ("auctionId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_bids_auction_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "bids"`);
  }
}
