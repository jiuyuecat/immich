<script lang="ts">
  import AlbumCard from '$lib/components/album-page/AlbumCard.svelte';
  import { Route } from '$lib/route';
  import { getAlbumActions } from '$lib/services/album.service';
  import { createAlbumAndRedirect } from '$lib/utils/album-utils';
  import { type AlbumResponseDto } from '@immich/sdk';
  import { IconButton } from '@immich/ui';
  import { mdiPlus } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    albums: AlbumResponseDto[];
    parentAlbum: AlbumResponseDto;
    canEdit?: boolean;
  }

  let { albums, parentAlbum, canEdit = false }: Props = $props();

  const createSubAlbum = () => createAlbumAndRedirect(undefined, undefined, parentAlbum.id);
</script>

{#if albums.length > 0 || canEdit}
  <section class="mt-6" data-testid="sub-albums">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-lg font-semibold dark:text-immich-dark-fg">
        {$t('sub_albums')}
        {#if albums.length > 0}
          <span class="text-sm font-normal text-gray-500">({albums.length})</span>
        {/if}
      </p>

      {#if canEdit}
        <IconButton
          variant="ghost"
          shape="round"
          color="secondary"
          aria-label={$t('create_sub_album')}
          onclick={createSubAlbum}
          icon={mdiPlus}
        />
      {/if}
    </div>

    {#if albums.length > 0}
      <div class="grid grid-auto-fill-56 gap-y-4">
        {#each albums as album, index (album.id)}
          {@const { Edit, Share, Download, Leave, Delete } = getAlbumActions($t, album)}
          {@const items = [Edit, Share, Download, Leave, Delete]}
          <a href={Route.viewAlbum(album)} class="h-fit">
            <AlbumCard {album} preload={index < 20} contextMenuItems={items} showItemCount />
          </a>
        {/each}
      </div>
    {/if}
  </section>
{/if}
