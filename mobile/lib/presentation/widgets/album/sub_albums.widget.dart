import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/extensions/build_context_extensions.dart';
import 'package:immich_mobile/extensions/theme_extensions.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/presentation/widgets/album/new_album_name_modal.widget.dart';
import 'package:immich_mobile/presentation/widgets/images/thumbnail.widget.dart';
import 'package:immich_mobile/providers/infrastructure/album.provider.dart';
import 'package:immich_mobile/providers/infrastructure/asset.provider.dart';
import 'package:immich_mobile/providers/user.provider.dart';
import 'package:immich_mobile/routing/router.dart';
import 'package:immich_mobile/utils/album_hierarchy.utils.dart';
import 'package:immich_mobile/widgets/common/immich_toast.dart';

/// Trail of parent albums shown above an album, so nested albums are not
/// stranded without context. Renders nothing for top-level albums.
class AlbumBreadcrumb extends ConsumerWidget {
  final RemoteAlbum album;

  const AlbumBreadcrumb({super.key, required this.album});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ancestors = ref.watch(remoteAlbumProvider.select((state) => albumAncestors(state.albums, album)));
    if (ancestors.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    final path = [...ancestors.reversed, album];
    final style = context.textTheme.labelLarge?.copyWith(color: context.colorScheme.onSurfaceSecondary);
    final currentStyle = context.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600);

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
        child: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 2,
          children: [
            for (var i = 0; i < path.length; i++) ...[
              if (i > 0)
                Icon(Icons.chevron_right_rounded, size: 16, color: context.colorScheme.onSurfaceSecondary),
              if (i == path.length - 1)
                Text(path[i].name, style: currentStyle, maxLines: 1, overflow: TextOverflow.ellipsis)
              else
                InkWell(
                  borderRadius: const BorderRadius.all(Radius.circular(6)),
                  onTap: () => unawaited(context.pushRoute(RemoteAlbumRoute(album: path[i]))),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    child: Text(path[i].name, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Folder-style section listing the direct sub-albums of [album], with an
/// entry point to create a new one. Sub-album photos stay in the sub-album.
class SubAlbumsSliver extends ConsumerWidget {
  static const double _cardWidth = 104;
  static const double _sectionHeight = 172;

  final RemoteAlbum album;
  final void Function(RemoteAlbum) onAlbumSelected;

  const SubAlbumsSliver({super.key, required this.album, required this.onAlbumSelected});

  Future<void> _createSubAlbum(BuildContext context, WidgetRef ref) async {
    final name = await showDialog<String?>(
      context: context,
      builder: (context) =>
          NewAlbumNameModal(title: context.t.create_sub_album, confirmLabel: context.t.create),
    );

    if (name == null || name.isEmpty || !context.mounted) {
      return;
    }

    try {
      final created = await ref
          .read(remoteAlbumProvider.notifier)
          .createAlbum(title: name, parentAlbumId: album.id);
      if (created == null || !context.mounted) {
        return;
      }

      onAlbumSelected(created);
    } catch (_) {
      if (!context.mounted) {
        return;
      }

      ImmichToast.show(context: context, toastType: ToastType.error, msg: context.t.errors.failed_to_create_album);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(remoteAlbumProvider.select((state) => childAlbums(state.albums, album.id)));
    final userId = ref.watch(currentUserProvider.select((user) => user?.id));
    final isOwner = userId != null && userId == album.ownerId;

    if (children.isEmpty && !isOwner) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 8, 0),
            child: Row(
              children: [
                Text(context.t.sub_albums, style: context.textTheme.titleSmall),
                const SizedBox(width: 8),
                if (children.isNotEmpty)
                  Text(
                    '${children.length}',
                    style: context.textTheme.labelLarge?.copyWith(color: context.colorScheme.onSurfaceSecondary),
                  ),
                const Spacer(),
                if (isOwner)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: () => unawaited(_createSubAlbum(context, ref)),
                    icon: Icon(Icons.add_rounded, size: 18, color: context.primaryColor),
                    label: Text(
                      context.t.create_sub_album,
                      style: TextStyle(color: context.primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: _sectionHeight,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                if (isOwner)
                  _NewSubAlbumCard(
                    width: _cardWidth,
                    label: context.t.create_sub_album,
                    onTap: () => unawaited(_createSubAlbum(context, ref)),
                  ),
                for (final child in children)
                  _SubAlbumCard(
                    album: child,
                    width: _cardWidth,
                    isOwner: userId != null && userId == child.ownerId,
                    onTap: () => onAlbumSelected(child),
                  ),
              ],
            ),
          ),
          const Divider(height: 24, indent: 16, endIndent: 16),
        ],
      ),
    );
  }
}

class _NewSubAlbumCard extends StatelessWidget {
  final double width;
  final String label;
  final VoidCallback onTap;

  const _NewSubAlbumCard({required this.width, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(16)),
        onTap: onTap,
        child: SizedBox(
          width: width,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: width,
                height: width,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: context.colorScheme.surfaceContainer,
                    borderRadius: const BorderRadius.all(Radius.circular(16)),
                    border: Border.all(color: context.colorScheme.outline.withAlpha(60)),
                  ),
                  child: Icon(Icons.create_new_folder_outlined, size: 28, color: context.colorScheme.onSurfaceSecondary),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.textTheme.labelMedium?.copyWith(color: context.colorScheme.onSurfaceSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SubAlbumCard extends ConsumerWidget {
  final RemoteAlbum album;
  final double width;
  final bool isOwner;
  final VoidCallback onTap;

  const _SubAlbumCard({required this.album, required this.width, required this.isOwner, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final thumbnailAsset = ref.watch(assetServiceProvider).getRemoteAsset(album.thumbnailAssetId ?? '');

    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(16)),
        onTap: onTap,
        child: SizedBox(
          width: width,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.all(Radius.circular(16)),
                child: SizedBox(
                  width: width,
                  height: width,
                  child: FutureBuilder(
                    future: thumbnailAsset,
                    builder: (context, snapshot) {
                      if (snapshot.hasData && snapshot.data != null) {
                        return Thumbnail.remote(
                          remoteId: album.thumbnailAssetId!,
                          thumbhash: snapshot.data!.thumbHash ?? '',
                        );
                      }

                      return ColoredBox(
                        color: context.colorScheme.surfaceContainer,
                        child: const Icon(Icons.photo_album_rounded, size: 28, color: Colors.grey),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                album.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
              ),
              Text(
                isOwner ? context.t.owned : context.t.shared_by_user(user: album.ownerName),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.textTheme.labelSmall?.copyWith(color: context.colorScheme.onSurfaceSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
