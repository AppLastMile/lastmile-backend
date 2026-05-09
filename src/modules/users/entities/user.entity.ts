import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  ORGANIZER = 'organizer',
  VOLUNTEER = 'volunteer',
  DONOR = 'donor',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  name!: string;

  @Column({ unique: true, length: 120 })
  email!: string;

  @Column({ type: 'varchar', length: 255, select: false, nullable: true })
  password?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  googleId?: string | null;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @CreateDateColumn()
  createdAt!: Date;
}
