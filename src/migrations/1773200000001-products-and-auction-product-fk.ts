import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductsAndAuctionProductFk1773200000001 implements MigrationInterface {
  name = 'ProductsAndAuctionProductFk1773200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create products table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" SERIAL NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "createdBy" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);

    // Add productId to auctions (required)
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "productId" integer NOT NULL DEFAULT 0`,
    );
    // Remove the temporary default now that column exists
    await queryRunner.query(
      `ALTER TABLE "auctions" ALTER COLUMN "productId" DROP DEFAULT`,
    );

    // Make campaignId nullable
    await queryRunner.query(
      `ALTER TABLE "auctions" ALTER COLUMN "campaignId" DROP NOT NULL`,
    );

    // Drop old campaign-based index and create product-based index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_auctions_campaign_status_created_at"`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_auctions_product_status_created_at"
      ON "auctions" ("productId", "status", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_auctions_product_status_created_at"`,
    );
    await queryRunner.query(`
      CREATE INDEX "idx_auctions_campaign_status_created_at"
      ON "auctions" ("campaignId", "status", "createdAt")
    `);
    await queryRunner.query(
      `ALTER TABLE "auctions" ALTER COLUMN "campaignId" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "productId"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
