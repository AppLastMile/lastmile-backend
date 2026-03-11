import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuctionStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

@Entity('auctions')
@Index('idx_auctions_campaign_status_created_at', [
  'campaignId',
  'status',
  'createdAt',
])
export class Auction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  campaignId!: number;

  @Column()
  sellerId!: number;

  @Column({ length: 150 })
  itemName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({ length: 3, default: 'COP' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.ACTIVE,
  })
  status!: AuctionStatus;

  @Column({ type: 'int', nullable: true })
  buyerId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  soldAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
