import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';
import 'package:immich_mobile/extensions/theme_extensions.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/pages/common/large_leading_tile.dart';
import 'package:immich_mobile/presentation/widgets/images/thumbnail.widget.dart';
import 'package:immich_mobile/providers/infrastructure/album.provider.dart';
import 'package:immich_mobile/providers/infrastructure/asset.provider.dart';
import 'package:immich_mobile/utils/album_hierarchy.utils.dart';

class AlbumTile extends ConsumerWidget {
  const AlbumTile({super.key, required this.album, required this.isOwner, this.onAlbumSelected});

  final RemoteAlbum album;
  final bool isOwner;
  final Function(RemoteAlbum)? onAlbumSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final albumThumbnailAsset = ref.watch(assetServiceProvider).getRemoteAsset(album.thumbnailAssetId ?? "");
    // Sub-albums are counted as part of the album, mirroring the web UI.
    final subtree = ref.watch(remoteAlbumProvider.select((state) {
      final albums = state.albums;
      final subtreeIds = albumSubtreeIds(albums, album.id);
      var assetCountTotal = 0;
      for (final candidate in albums) {
        if (subtreeIds.contains(candidate.id)) {
          assetCountTotal += candidate.assetCount;
        }
      }
      return (subAlbums: childAlbums(albums, album.id).length, assetCountTotal: assetCountTotal);
    }));
    final countLabel = subtree.subAlbums > 0
        ? context.t.sub_albums_and_items(subAlbums: subtree.subAlbums, count: subtree.assetCountTotal)
        : context.t.items_count(count: album.assetCount);

    return LargeLeadingTile(
      title: Text(
        album.name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: context.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        '$countLabel • ${isOwner ? context.t.owned : context.t.shared_by_user(user: album.ownerName)}',
        overflow: TextOverflow.ellipsis,
        style: context.textTheme.bodyMedium?.copyWith(color: context.colorScheme.onSurfaceSecondary),
      ),
      onTap: () => onAlbumSelected?.call(album),
      leadingPadding: const EdgeInsets.only(right: 16),
      leading: FutureBuilder(
        future: albumThumbnailAsset,
        builder: (context, snapshot) {
          return snapshot.hasData && snapshot.data != null
              ? ClipRRect(
                  borderRadius: const BorderRadius.all(Radius.circular(15)),
                  child: SizedBox(
                    width: 80,
                    height: 80,
                    child: Thumbnail.remote(
                      remoteId: album.thumbnailAssetId!,
                      thumbhash: snapshot.data!.thumbHash ?? "",
                    ),
                  ),
                )
              : SizedBox(
                  width: 80,
                  height: 80,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: context.colorScheme.surfaceContainer,
                      borderRadius: const BorderRadius.all(Radius.circular(16)),
                      border: Border.all(color: context.colorScheme.outline.withAlpha(50), width: 1),
                    ),
                    child: const Icon(Icons.photo_album_rounded, size: 24, color: Colors.grey),
                  ),
                );
        },
      ),
    );
  }
}
