import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuctionWinnerAndNotifications1773200000003 implements MigrationInterface {
  name = 'AddAuctionWinnerAndNotifications1773200000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "winnerId" integer`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "message" text NOT NULL,
        "auctionId" integer,
        "read" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_user_created_at"
      ON "notifications" ("userId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notifications_user_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN IF EXISTS "winnerId"`,
    );
  }
}
