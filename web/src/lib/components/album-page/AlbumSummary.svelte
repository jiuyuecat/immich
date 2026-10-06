<script lang="ts">
  import { getAlbumDateRange } from '$lib/utils/date-time';
  import type { AlbumResponseDto } from '@immich/sdk';
  import { t } from 'svelte-i18n';

  type Props = {
    album: AlbumResponseDto;
  };

  const { album }: Props = $props();
  const startDate = album.startDate;
</script>

<span class="my-2 flex gap-2 text-sm font-medium text-gray-500" data-testid="album-details">
  {#if startDate}
    <span>{getAlbumDateRange(startDate, album.endDate ?? startDate)}</span>
    <span>•</span>
  {/if}
  <span>
    {#if album.subAlbumCount > 0}
      {$t('sub_albums_and_items', { values: { subAlbums: album.subAlbumCount, count: album.assetCountTotal } })}
    {:else}
      {$t('items_count', { values: { count: album.assetCount } })}
    {/if}
  </span>
</span>
