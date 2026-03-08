import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum CampaignType {
  MONEY = 'money',
  PHYSICAL_ITEMS = 'physical_items',
  MIXED = 'mixed',
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 150 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: CampaignType })
  campaignType!: CampaignType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  goalMoney!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  collectedMoney!: number;

  @Column()
  eventId!: number;

  @Column()
  createdBy!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
