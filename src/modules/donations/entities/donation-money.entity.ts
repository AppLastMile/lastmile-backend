import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('donation_money')
export class DonationMoney {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  campaignId!: number;

  @Column()
  donorId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
