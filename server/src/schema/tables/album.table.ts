import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ForeignKeyColumn,
  type Generated,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from '@immich/sql-tools';
import { UpdateIdColumn, UpdatedAtTrigger } from 'src/decorators.js';
import { AssetOrder } from 'src/enum.js';
import { AssetTable } from 'src/schema/tables/asset.table.js';

@Table({ name: 'album' })
@UpdatedAtTrigger('album_updatedAt')
@Check({ name: 'album_parentAlbumId_chk', expression: `"parentAlbumId" != "id"` })
export class AlbumTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ default: 'Untitled Album' })
  albumName!: Generated<string>;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @ForeignKeyColumn(() => AssetTable, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    comment: 'Asset ID to be used as thumbnail',
  })
  albumThumbnailAssetId!: string | null;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @DeleteDateColumn()
  deletedAt!: Timestamp | null;

  @Column({ type: 'boolean', default: true })
  isActivityEnabled!: Generated<boolean>;

  @Column({ default: AssetOrder.Desc })
  order!: Generated<AssetOrder>;

  @ForeignKeyColumn(() => AlbumTable, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
    comment: 'Parent album ID for nested albums',
  })
  parentAlbumId!: string | null;

  @UpdateIdColumn({ index: true })
  updateId!: Generated<string>;
}
