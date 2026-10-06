<script lang="ts">
  import { initInput } from '$lib/actions/focus';
  import AlbumCover from '$lib/components/album-page/AlbumCover.svelte';
  import { handleUpdateAlbum, isAlbumOwner } from '$lib/services/album.service';
  import { getAlbumPath, getSubtreeIds } from '$lib/utils/album-utils';
  import { normalizeSearchString } from '$lib/utils/string-utils';
  import { getAllAlbums, type AlbumResponseDto } from '@immich/sdk';
  import { ListButton, LoadingSpinner, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  interface Props {
    album: AlbumResponseDto;
    onClose: () => void;
  }

  let { album, onClose }: Props = $props();

  let albums: AlbumResponseDto[] = $state([]);
  let loading = $state(true);
  let search = $state('');

  // Candidate parents: albums the user owns, minus this album and its own sub-tree (which would
  // create a cycle).
  const candidates = $derived.by(() => {
    const excluded = getSubtreeIds(albums, album.id);
    const query = normalizeSearchString(search);

    return albums
      .filter((candidate) => !excluded.has(candidate.id) && isAlbumOwner(candidate))
      .map((candidate) => ({ album: candidate, path: getAlbumPath(albums, candidate.id) }))
      .filter(({ path }) => normalizeSearchString(path.map(({ albumName }) => albumName).join(' ')).includes(query))
      .sort((a, b) => a.album.albumName.localeCompare(b.album.albumName));
  });

  onMount(async () => {
    albums = await getAllAlbums({});
    loading = false;
  });

  const move = async (parentAlbumId: string | null) => {
    const success = await handleUpdateAlbum(album, { parentAlbumId });
    if (success) {
      onClose();
    }
  };
</script>

<Modal title={$t('move_album')} {onClose} size="small">
  <ModalBody>
    {#if loading}
      <div class="flex w-full place-content-center place-items-center py-6">
        <LoadingSpinner />
      </div>
    {:else}
      <Stack>
        <input
          class="border-b-4 border-immich-bg px-6 py-2 text-2xl focus:border-immich-primary dark:border-immich-dark-gray dark:focus:border-immich-dark-primary"
          placeholder={$t('search')}
          bind:value={search}
          use:initInput
        />

        <ListButton selected={album.parentAlbumId === null} onclick={() => move(null)}>
          <div class="grow text-start">
            <Text fontWeight="medium">{$t('no_parent_album')}</Text>
          </div>
        </ListButton>

        {#each candidates as { album: candidate, path } (candidate.id)}
          <ListButton selected={album.parentAlbumId === candidate.id} onclick={() => move(candidate.id)}>
            <AlbumCover album={candidate} class="size-10 shrink-0 rounded-lg" />
            <div class="grow text-start">
              <Text fontWeight="medium">{candidate.albumName}</Text>
              {#if path.length > 1}
                <Text size="tiny" color="muted">{path.map(({ albumName }) => albumName).join(' / ')}</Text>
              {/if}
            </div>
          </ListButton>
        {:else}
          <Text class="py-6">{$t('album_search_not_found')}</Text>
        {/each}
      </Stack>
    {/if}
  </ModalBody>
</Modal>
