import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum DonationItemStatus {
  PENDING = 'pending',
  DELIVERED_TO_PICKUP_POINT = 'delivered_to_pickup_point',
  ASSIGNED_TO_SHIPMENT = 'assigned_to_shipment',
  DELIVERED = 'delivered',
}

@Entity('donation_items')
export class DonationItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  campaignId!: number;

  @Column()
  donorId!: number;

  @Column({ length: 120 })
  itemName!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    type: 'enum',
    enum: DonationItemStatus,
    default: DonationItemStatus.PENDING,
  })
  status!: DonationItemStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
