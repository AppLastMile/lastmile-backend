import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('bids')
@Index('idx_bids_auction_created_at', ['auctionId', 'createdAt'])
export class Bid {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  auctionId!: number;

  @Column()
  userId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
