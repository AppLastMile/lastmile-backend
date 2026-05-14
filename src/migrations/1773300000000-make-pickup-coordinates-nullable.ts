import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePickupCoordinatesNullable1773300000000 implements MigrationInterface {
  name = 'MakePickupCoordinatesNullable1773300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "pickup_points" ALTER COLUMN "latitude" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "pickup_points" ALTER COLUMN "longitude" DROP NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "pickup_points" ALTER COLUMN "latitude" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "pickup_points" ALTER COLUMN "longitude" SET NOT NULL',
    );
  }
}
