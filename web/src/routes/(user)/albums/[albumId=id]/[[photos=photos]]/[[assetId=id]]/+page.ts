import { getAllAlbums, getAlbumInfo, type AlbumResponseDto } from '@immich/sdk';
import { authenticate } from '$lib/utils/auth';
import type { PageLoad } from './$types';

// Walk up the parent chain to build the breadcrumb. Stops when an ancestor is not accessible
// to the current user (a sub-album can be shared directly without its parent being shared).
const loadAncestors = async (album: AlbumResponseDto): Promise<AlbumResponseDto[]> => {
  const ancestors: AlbumResponseDto[] = [];
  const seen = new Set<string>([album.id]);
  let parentId = album.parentAlbumId;

  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    try {
      const parent = await getAlbumInfo({ id: parentId });
      ancestors.unshift(parent);
      parentId = parent.parentAlbumId;
    } catch {
      break;
    }
  }

  return ancestors;
};

export const load = (async ({ params, url, depends }) => {
  await authenticate(url);

  depends('album:data');

  const album = await getAlbumInfo({ id: params.albumId });
  const [childAlbums, ancestors] = await Promise.all([getAllAlbums({ parentId: album.id }), loadAncestors(album)]);

  return {
    album,
    childAlbums,
    ancestors,
    meta: {
      title: album.albumName,
    },
  };
}) satisfies PageLoad;
