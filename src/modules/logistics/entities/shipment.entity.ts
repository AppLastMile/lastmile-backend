import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

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

  @Column({ nullable: true })
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

  @ManyToOne(() => Campaign, (campaign: Campaign) => campaign.shipments)
  @JoinColumn({ name: 'campaignId' })
  campaign!: Campaign;
}