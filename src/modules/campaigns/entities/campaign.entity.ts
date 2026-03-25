import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { PickupPoint } from '../../pickup-points/entities/pickup-point.entity';

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

  @OneToMany(() => PickupPoint, (point) => point.campaign)
  pickupPoints!: PickupPoint[];
}
