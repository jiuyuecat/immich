import { getAllAlbums } from '@immich/sdk';
import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import type { PageLoad } from './$types';

export const load = (async ({ url }) => {
  await authenticate(url);
  // only top-level (root) albums are listed; sub-albums are shown inside their parent album
  const sharedAlbums = await getAllAlbums({ isShared: true, rootOnly: true });
  const albums = await getAllAlbums({ isOwned: true, rootOnly: true });
  const $t = await getFormatter();

  return {
    albums,
    sharedAlbums,
    meta: {
      title: $t('albums'),
    },
  };
}) satisfies PageLoad;
