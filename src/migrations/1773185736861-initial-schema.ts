import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1773185736861 implements MigrationInterface {
  name = 'InitialSchema1773185736861';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('organizer', 'volunteer', 'donor')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying(120) NOT NULL, "email" character varying(120) NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum" AS ENUM('pending', 'assigned', 'in_transit', 'delivered')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipments" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "pickupPointId" integer NOT NULL, "assignedVolunteerId" integer, "status" "public"."shipments_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pickup_points" ("id" SERIAL NOT NULL, "name" character varying(120) NOT NULL, "city" character varying(120) NOT NULL, "address" character varying(180) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8fe939caf756e30da9a5b5d7317" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "events" ("id" SERIAL NOT NULL, "name" character varying(150) NOT NULL, "disasterType" character varying(80) NOT NULL, "city" character varying(120) NOT NULL, "description" text NOT NULL, "date" TIMESTAMP NOT NULL, "createdBy" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "donation_money" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "donorId" integer NOT NULL, "amount" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_212f5ebd078d19bd6121cd86e03" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donation_items_status_enum" AS ENUM('pending', 'delivered_to_pickup_point', 'assigned_to_shipment', 'delivered')`,
    );
    await queryRunner.query(
      `CREATE TABLE "donation_items" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "donorId" integer NOT NULL, "itemName" character varying(120) NOT NULL, "quantity" integer NOT NULL, "status" "public"."donation_items_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2739debedda43303f5ec34e6a6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "userId" integer NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_campaigntype_enum" AS ENUM('money', 'physical_items', 'mixed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" SERIAL NOT NULL, "name" character varying(150) NOT NULL, "description" text NOT NULL, "campaignType" "public"."campaigns_campaigntype_enum" NOT NULL, "goalMoney" numeric(12,2) NOT NULL DEFAULT '0', "collectedMoney" numeric(12,2) NOT NULL DEFAULT '0', "eventId" integer NOT NULL, "createdBy" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TYPE "public"."campaigns_campaigntype_enum"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "donation_items"`);
    await queryRunner.query(`DROP TYPE "public"."donation_items_status_enum"`);
    await queryRunner.query(`DROP TABLE "donation_money"`);
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TABLE "pickup_points"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
