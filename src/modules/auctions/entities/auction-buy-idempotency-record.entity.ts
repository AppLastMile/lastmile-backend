import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('auction_buy_idempotency_records')
@Index(
  'uq_auction_buy_idempotency',
  ['auctionId', 'buyerId', 'idempotencyKey'],
  {
    unique: true,
  },
)
export class AuctionBuyIdempotencyRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  auctionId!: number;

  @Column()
  buyerId!: number;

  @Column({ length: 100 })
  idempotencyKey!: string;

  @Column({ type: 'int' })
  statusCode!: number;

  @Column({ type: 'jsonb' })
  responsePayload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
