import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/domain/models/album/album.model.dart';
import 'package:immich_mobile/utils/album_hierarchy.utils.dart';

RemoteAlbum album(String id, {String? parentAlbumId, String? name}) => RemoteAlbum(
  id: id,
  name: name ?? id,
  ownerId: 'owner',
  description: '',
  createdAt: DateTime(2026),
  updatedAt: DateTime(2026),
  isActivityEnabled: true,
  order: AlbumAssetOrder.desc,
  assetCount: 0,
  ownerName: 'owner',
  isShared: false,
  parentAlbumId: parentAlbumId,
);

void main() {
  group('rootAlbums', () {
    test('keeps albums without a parent', () {
      final albums = [album('a'), album('b', parentAlbumId: 'a')];
      expect(rootAlbums(albums).map((a) => a.id), ['a']);
    });

    test('keeps an album whose parent is not visible to the user', () {
      // e.g. a sub-album shared directly, without access to its parent
      final albums = [album('b', parentAlbumId: 'hidden')];
      expect(rootAlbums(albums).map((a) => a.id), ['b']);
    });
  });

  group('childAlbums', () {
    test('returns only direct children', () {
      final albums = [album('a'), album('b', parentAlbumId: 'a'), album('c', parentAlbumId: 'b')];
      expect(childAlbums(albums, 'a').map((a) => a.id), ['b']);
      expect(childAlbums(albums, 'b').map((a) => a.id), ['c']);
      expect(childAlbums(albums, 'c'), isEmpty);
    });
  });

  group('albumAncestors', () {
    test('returns ancestors closest first', () {
      final albums = [
        album('root', name: '二次元'),
        album('mid', parentAlbumId: 'root', name: 'nacho'),
        album('leaf', parentAlbumId: 'mid', name: '纳西妲'),
      ];
      final leaf = albums.last;
      expect(albumAncestors(albums, leaf).map((a) => a.name), ['nacho', '二次元']);
    });

    test('stops cleanly on a cycle instead of looping forever', () {
      final albums = [album('a', parentAlbumId: 'b'), album('b', parentAlbumId: 'a')];
      expect(albumAncestors(albums, albums.first).map((a) => a.id), ['b']);
    });

    test('stops when the parent is not visible', () {
      final child = album('child', parentAlbumId: 'hidden');
      expect(albumAncestors([child], child), isEmpty);
    });

    test('is empty for a top level album', () {
      expect(albumAncestors([album('a')], album('a')), isEmpty);
    });
  });

  group('albumSubtreeIds', () {
    test('contains the album and every descendant', () {
      final albums = [album('a'), album('b', parentAlbumId: 'a'), album('c', parentAlbumId: 'b'), album('other')];
      expect(albumSubtreeIds(albums, 'a'), {'a', 'b', 'c'});
      expect(albumSubtreeIds(albums, 'b'), {'b', 'c'});
      expect(albumSubtreeIds(albums, 'other'), {'other'});
    });
  });

  group('albumPathLabel', () {
    test('joins the full hierarchy', () {
      final albums = [album('root', name: '二次元'), album('child', parentAlbumId: 'root', name: 'nacho')];
      expect(albumPathLabel(albums, albums.last), '二次元 / nacho');
    });
  });

  group('serverHonouredParent', () {
    test('accepts a matching parent', () {
      expect(serverHonouredParent(album('a', parentAlbumId: 'p'), 'p'), isTrue);
      expect(serverHonouredParent(album('a'), null), isTrue);
    });

    test('rejects a server that dropped parentAlbumId', () {
      // A server without nested-album support answers 200 but echoes back null
      expect(serverHonouredParent(album('a'), 'p'), isFalse);
    });

    test('rejects a stale parent', () {
      expect(serverHonouredParent(album('a', parentAlbumId: 'old'), 'new'), isFalse);
    });
  });
}
