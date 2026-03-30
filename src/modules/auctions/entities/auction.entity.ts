import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuctionStatus {
  CREATED = 'created',
  ACTIVE = 'active',
  CLOSED = 'closed',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

export enum AuctionBidMode {
  FREE = 'free',
  FIXED_INCREMENT = 'fixed_increment',
}

@Entity('auctions')
@Index('idx_auctions_product_status_created_at', [
  'productId',
  'status',
  'createdAt',
])
export class Auction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  productId!: number;

  @Column({ type: 'int', nullable: true })
  campaignId!: number | null;

  @Column()
  sellerId!: number;

  @Column({ length: 150 })
  itemName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  initialPrice!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  currentPrice!: number | null;

  @Column({ length: 3, default: 'COP' })
  currency!: string;

  @Column({ type: 'int' })
  durationMinutes!: number;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.CREATED,
  })
  status!: AuctionStatus;

  @Column({ type: 'int', nullable: true })
  buyerId!: number | null;

  @Column({ type: 'int', nullable: true })
  winnerId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  soldAt!: Date | null;

  @Column({
    type: 'enum',
    enum: AuctionBidMode,
    default: AuctionBidMode.FREE,
  })
  bidMode!: AuctionBidMode;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  bidIncrement!: number | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
