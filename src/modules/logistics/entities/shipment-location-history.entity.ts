import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('shipment_location_history')
@Index('idx_shipment_location_history_shipment_recorded_at', [
  'shipmentId',
  'recordedAt',
])
export class ShipmentLocationHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  shipmentId!: number;

  @Column({ type: 'int' })
  campaignId!: number;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'double precision', nullable: true })
  speed!: number | null;

  @Column({ type: 'double precision', nullable: true })
  heading!: number | null;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'int' })
  updatedBy!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
