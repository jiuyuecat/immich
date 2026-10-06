import 'package:drift/drift.dart';
import 'package:immich_mobile/data/db/main/table/remote/asset.dart';
import 'package:immich_mobile/data/db/util/datetime_clamp_type.dart';
import 'package:immich_mobile/data/db/util/defaults_mixin.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';

// Intentionally no foreign key to itself: sync can deliver a child album before
// its parent, and the server cascades deletions of an album subtree.
@TableIndex.sql('CREATE INDEX IF NOT EXISTS idx_remote_album_parent ON remote_album_entity (parent_album_id)')
class RemoteAlbumEntity extends Table with DriftDefaultsMixin {
  const RemoteAlbumEntity();

  TextColumn get id => text()();

  TextColumn get name => text()();

  TextColumn get description => text().withDefault(const Constant(''))();

  DateTimeColumn get createdAt => customType(clampedDateTime).withDefault(currentDateAndTime)();

  DateTimeColumn get updatedAt => customType(clampedDateTime).withDefault(currentDateAndTime)();

  TextColumn get thumbnailAssetId =>
      text().references(RemoteAssetEntity, #id, onDelete: KeyAction.setNull).nullable()();

  BoolColumn get isActivityEnabled => boolean().withDefault(const Constant(true))();

  IntColumn get order => intEnum<AlbumAssetOrder>()();

  /// Direct parent album, `null` for a top-level album.
  TextColumn get parentAlbumId => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
