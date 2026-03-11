import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('pickup_points')
export class PickupPoint {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 120 })
  city!: string;

  @Column({ length: 180 })
  address!: string;

  @Column({ type: 'int', default: 0, nullable: true })
  eventId!: number;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
