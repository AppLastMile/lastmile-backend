import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1773187584685 implements MigrationInterface {
  name = 'InitialSchema1773187584685';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shipment_locations" ("id" SERIAL NOT NULL, "shipmentId" integer NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "speed" double precision NOT NULL DEFAULT '0', "heading" double precision NOT NULL DEFAULT '0', "recordedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_88047f0004015b94734b335d60f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auctions_status_enum" AS ENUM('active', 'sold', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auctions" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "sellerId" integer NOT NULL, "itemName" character varying(120) NOT NULL, "description" text, "price" numeric(12,2) NOT NULL, "currency" character varying(12), "status" "public"."auctions_status_enum" NOT NULL DEFAULT 'active', "buyerId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "soldAt" TIMESTAMP, CONSTRAINT "PK_87d2b34d4829f0519a5c5570368" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "shipments" ADD "eventId" integer`);
    await queryRunner.query(
      `ALTER TABLE "pickup_points" ADD "eventId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pickup_points" DROP COLUMN "eventId"`,
    );
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "eventId"`);
    await queryRunner.query(`DROP TABLE "auctions"`);
    await queryRunner.query(`DROP TYPE "public"."auctions_status_enum"`);
    await queryRunner.query(`DROP TABLE "shipment_locations"`);
  }
}
