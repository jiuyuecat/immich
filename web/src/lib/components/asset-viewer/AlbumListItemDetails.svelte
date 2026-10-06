<script lang="ts">
  import type { AlbumResponseDto } from '@immich/sdk';
  import { t } from 'svelte-i18n';

  interface Props {
    album: AlbumResponseDto;
  }

  let { album }: Props = $props();
</script>

<span>
  {#if album.subAlbumCount > 0}
    {$t('sub_albums_and_items', { values: { subAlbums: album.subAlbumCount, count: album.assetCountTotal } })}
  {:else}
    {$t('items_count', { values: { count: album.assetCount } })}
  {/if}
</span>
{#if album.shared}
  <span>• {$t('shared')}</span>
{/if}
