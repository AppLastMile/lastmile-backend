import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 150 })
  name!: string;

  @Column({ length: 80 })
  disasterType!: string;

  @Column({ length: 120 })
  city!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'timestamp' })
  date!: Date;

  @Column()
  createdBy!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
