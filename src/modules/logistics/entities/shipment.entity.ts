import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ShipmentStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  campaignId!: number;

  @Column()
  pickupPointId!: number;

  @Column({ type: 'int', nullable: true })
  assignedVolunteerId!: number | null;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.PENDING,
  })
  status!: ShipmentStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
