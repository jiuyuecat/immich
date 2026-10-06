import 'package:immich_mobile/domain/models/album/album.model.dart';

/// Albums that belong at the top level of the album list.
///
/// An album is a "root" when it has no parent, or when its parent is not
/// visible to the current user (e.g. a sub-album shared directly with them).
/// This keeps such albums reachable instead of hiding them behind a parent
/// they cannot open.
List<RemoteAlbum> rootAlbums(List<RemoteAlbum> albums) {
  final visibleIds = albums.map((album) => album.id).toSet();

  return albums
      .where((album) => album.parentAlbumId == null || !visibleIds.contains(album.parentAlbumId))
      .toList();
}

/// Direct sub-albums of [albumId].
List<RemoteAlbum> childAlbums(List<RemoteAlbum> albums, String albumId) {
  return albums.where((album) => album.parentAlbumId == albumId).toList();
}

/// Ancestors of [album], closest parent first.
List<RemoteAlbum> albumAncestors(List<RemoteAlbum> albums, RemoteAlbum album) {
  final byId = {for (final a in albums) a.id: a};
  final ancestors = <RemoteAlbum>[];
  final visited = <String>{album.id};

  var current = album.parentAlbumId == null ? null : byId[album.parentAlbumId];
  while (current != null && visited.add(current.id)) {
    ancestors.add(current);
    current = current.parentAlbumId == null ? null : byId[current.parentAlbumId];
  }

  return ancestors;
}

/// [albumId] together with the ids of every album below it.
///
/// Used to exclude a subtree from the candidates when moving an album, since
/// moving an album into its own descendant would create a cycle.
Set<String> albumSubtreeIds(List<RemoteAlbum> albums, String albumId) {  final childrenByParent = <String, List<RemoteAlbum>>{};
  for (final album in albums) {
    final parentId = album.parentAlbumId;
    if (parentId != null) {
      childrenByParent.putIfAbsent(parentId, () => []).add(album);
    }
  }

  final subtree = <String>{albumId};
  final queue = <String>[albumId];
  while (queue.isNotEmpty) {
    for (final child in childrenByParent[queue.removeLast()] ?? const <RemoteAlbum>[]) {
      if (subtree.add(child.id)) {
        queue.add(child.id);
      }
    }
  }

  return subtree;
}

/// Human readable location of [album], e.g. `二次元 / nacho`.
String albumPathLabel(List<RemoteAlbum> albums, RemoteAlbum album) {
  final ancestors = albumAncestors(albums, album);

  return [...ancestors.reversed, album].map((a) => a.name).join(' / ');
}
