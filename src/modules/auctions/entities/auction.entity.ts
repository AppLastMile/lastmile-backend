import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuctionStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

@Entity('auctions')
export class Auction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  campaignId!: number;

  @Column({ type: 'int' })
  sellerId!: number;

  @Column({ length: 120 })
  itemName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', length: 12, nullable: true })
  currency!: string | null;

  @Column({ type: 'enum', enum: AuctionStatus, default: AuctionStatus.ACTIVE })
  status!: AuctionStatus;

  @Column({ type: 'int', nullable: true })
  buyerId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  soldAt!: Date | null;
}