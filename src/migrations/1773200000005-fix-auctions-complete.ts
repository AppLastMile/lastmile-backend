import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAuctionsComplete1773200000005 implements MigrationInterface {
  name = 'FixAuctionsComplete1773200000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Renombrar bid_mode -> bidMode si existe con el nombre incorrecto
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'auctions' AND column_name = 'bid_mode'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'auctions' AND column_name = 'bidMode'
        ) THEN
          ALTER TABLE "auctions" RENAME COLUMN "bid_mode" TO "bidMode";
        END IF;
      END $$;
    `);

    // Renombrar bid_increment -> bidIncrement si existe con el nombre incorrecto
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'auctions' AND column_name = 'bid_increment'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'auctions' AND column_name = 'bidIncrement'
        ) THEN
          ALTER TABLE "auctions" RENAME COLUMN "bid_increment" TO "bidIncrement";
        END IF;
      END $$;
    `);

    // Agregar bidMode si no existe en ninguna forma
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."auctions_bid_mode_enum" AS ENUM('free', 'fixed_increment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "auctions"
        ADD COLUMN IF NOT EXISTS "bidMode" "public"."auctions_bid_mode_enum" NOT NULL DEFAULT 'free'
    `);

    // Agregar bidIncrement si no existe en ninguna forma
    await queryRunner.query(`
      ALTER TABLE "auctions"
        ADD COLUMN IF NOT EXISTS "bidIncrement" numeric(12,2) NULL
    `);

    // Agregar columna version (requerida por el servicio para control de concurrencia)
    await queryRunner.query(`
      ALTER TABLE "auctions"
        ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1
    `);

    // Crear tabla auction_buy_idempotency_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auction_buy_idempotency_records" (
        "id" SERIAL NOT NULL,
        "auctionId" integer NOT NULL,
        "buyerId" integer NOT NULL,
        "idempotencyKey" character varying(100) NOT NULL,
        "statusCode" integer NOT NULL,
        "responsePayload" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auction_buy_idempotency_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_auction_buy_idempotency"
      ON "auction_buy_idempotency_records" ("auctionId", "buyerId", "idempotencyKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_auction_buy_idempotency"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "auction_buy_idempotency_records"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN IF EXISTS "version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN IF EXISTS "bidIncrement"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN IF EXISTS "bidMode"`,
    );
  }
}
