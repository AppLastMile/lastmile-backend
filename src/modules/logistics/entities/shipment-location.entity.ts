import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('shipment_locations')
export class ShipmentLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  shipmentId!: number;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'double precision', default: 0 })
  speed!: number;

  @Column({ type: 'double precision', default: 0 })
  heading!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt!: Date;
}