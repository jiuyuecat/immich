<script lang="ts">
  import AlbumSharedLink from '$lib/components/album-page/AlbumSharedLink.svelte';
  import HeaderActionButton from '$lib/components/HeaderActionButton.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import UserAvatar from '$lib/components/shared-components/UserAvatar.svelte';
  import {
    getAlbumActions,
    handleRemoveUserFromAlbum,
    handleUpdateAlbum,
    handleUpdateUserAlbumRole,
    isAlbumOwner,
  } from '$lib/services/album.service';
  import {
    AlbumUserRole,
    AssetOrder,
    getAllAlbums,
    getAlbumInfo,
    getAllSharedLinks,
    type AlbumResponseDto,
    type SharedLinkResponseDto,
    type UserResponseDto,
  } from '@immich/sdk';
  import { getSubtreeIds } from '$lib/utils/album-utils';
  import { Field, HStack, Modal, ModalBody, Select, Stack, Switch, Text, type SelectOption } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  type Props = {
    album: AlbumResponseDto;
    readOnly?: boolean;
    onClose: () => void;
  };

  let { album, readOnly = false, onClose }: Props = $props();

  const handleRoleSelect = async (user: UserResponseDto, role: AlbumUserRole | 'none') => {
    if (role === 'none') {
      await handleRemoveUserFromAlbum(album, user);
      return;
    }

    const existing = album.albumUsers.find(({ user: albumUser }) => albumUser.id === user.id);
    await handleUpdateUserAlbumRole({
      albumId: album.id,
      userId: user.id,
      role,
      includeSubAlbums: existing?.includeSubAlbums,
    });
  };

  const refreshAlbum = async () => {
    album = await getAlbumInfo({ id: album.id });
  };

  const onAlbumUserDelete = async ({ userId }: { userId: string }) => {
    album.albumUsers = album.albumUsers.filter(({ user: { id } }) => id !== userId);
    await refreshAlbum();
  };

  const onSharedLinkCreate = (sharedLink: SharedLinkResponseDto) => {
    sharedLinks.push(sharedLink);
  };

  const onSharedLinkDelete = (sharedLink: SharedLinkResponseDto) => {
    sharedLinks = sharedLinks.filter(({ id }) => sharedLink.id !== id);
  };

  const { AddUsers, CreateSharedLink } = $derived(getAlbumActions($t, album));

  let sharedLinks: SharedLinkResponseDto[] = $state([]);
  let albums: AlbumResponseDto[] = $state([]);

  const canMove = $derived(!readOnly && isAlbumOwner(album));

  // sentinel for the "no parent" (top level) option, since Select only handles string values
  const ROOT_ALBUM_OPTION = '__root__';

  // candidate parents = accessible albums, excluding this album and its own sub-tree
  const parentAlbumOptions = $derived.by(() => {
    const options: SelectOption<string>[] = [{ label: $t('no_parent_album'), value: ROOT_ALBUM_OPTION }];
    if (!canMove) {
      return options;
    }

    const excluded = getSubtreeIds(albums, album.id);
    for (const candidate of [...albums].sort((a, b) => a.albumName.localeCompare(b.albumName))) {
      if (!excluded.has(candidate.id)) {
        options.push({ label: candidate.albumName, value: candidate.id });
      }
    }
    return options;
  });

  onMount(async () => {
    sharedLinks = await getAllSharedLinks({ albumId: album.id });
    albums = await getAllAlbums({});
  });
</script>

<OnEvents
  {onAlbumUserDelete}
  onAlbumShare={refreshAlbum}
  onAlbumUserUpdate={refreshAlbum}
  {onSharedLinkCreate}
  {onSharedLinkDelete}
  onAlbumUpdate={(newAlbum) => (album = newAlbum)}
/>

<Modal title={readOnly ? $t('album') : $t('options')} {onClose} size="small">
  <ModalBody>
    <Stack gap={6}>
      <div>
        <Text size="medium" fontWeight="semi-bold">{$t('settings')}</Text>
        <div class="mt-2 grid gap-y-3 ps-2">
          {#if album.order}
            <Field label={$t('display_order')} disabled={readOnly}>
              <Select
                value={album.order}
                options={[
                  { label: $t('newest_first'), value: AssetOrder.Desc },
                  { label: $t('oldest_first'), value: AssetOrder.Asc },
                ]}
                onChange={(value) => handleUpdateAlbum(album, { order: value })}
              />
            </Field>
          {/if}
          {#if canMove}
            <Field label={$t('parent_album')} description={$t('parent_album_description')}>
              <Select
                value={album.parentAlbumId ?? ROOT_ALBUM_OPTION}
                options={parentAlbumOptions}
                onChange={(value) =>
                  handleUpdateAlbum(album, { parentAlbumId: value === ROOT_ALBUM_OPTION ? null : value })}
              />
            </Field>
          {/if}
          <Field label={$t('comments_and_likes')} description={$t('let_others_respond')} disabled={readOnly}>
            <Switch
              checked={album.isActivityEnabled}
              onCheckedChange={(checked) => handleUpdateAlbum(album, { isActivityEnabled: checked })}
            />
          </Field>
        </div>
      </div>

      <div>
        <HStack fullWidth class="mb-2 justify-between">
          <Text size="medium" fontWeight="semi-bold">{$t('users')}</Text>
          {#if !readOnly}
            <HeaderActionButton action={AddUsers} />
          {/if}
        </HStack>
        <div class="ps-2">
          {#each album.albumUsers as { user, role, includeSubAlbums } (user.id)}
            <div class="flex items-center justify-between gap-4 py-2">
              <div class="flex flex-row items-center gap-2">
                <div>
                  <UserAvatar {user} size="md" />
                </div>
                <div>
                  <Text size="small">{user.name}</Text>
                  {#if role !== AlbumUserRole.Owner}
                    <Text size="tiny" color="muted">{$t('include_sub_albums')}</Text>
                  {/if}
                </div>
              </div>
              <div class="flex items-center gap-2">
                {#if role !== AlbumUserRole.Owner}
                  <Switch
                    checked={includeSubAlbums}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      handleUpdateUserAlbumRole({ albumId: album.id, userId: user.id, role, includeSubAlbums: checked })}
                  />
                {/if}
                <Field class="w-32" disabled={readOnly || role === AlbumUserRole.Owner}>
                  <Select
                    value={role}
                    options={[
                      { label: $t('role_editor'), value: AlbumUserRole.Editor },
                      { label: $t('role_viewer'), value: AlbumUserRole.Viewer },
                      { label: $t('owner'), value: AlbumUserRole.Owner, disabled: true },
                      { label: $t('remove_user'), value: 'none' },
                    ] as SelectOption<AlbumUserRole | 'none'>[]}
                    onChange={(value) => handleRoleSelect(user, value)}
                  />
                </Field>
              </div>
            </div>
          {/each}
        </div>
      </div>
      {#if !readOnly}
        <div class="mb-4">
          <HStack class="mb-2 justify-between">
            <Text size="medium" fontWeight="semi-bold">{$t('shared_links')}</Text>
            <HeaderActionButton action={CreateSharedLink} />
          </HStack>

          <div class="ps-2">
            <Stack gap={4}>
              {#each sharedLinks as sharedLink (sharedLink.id)}
                <AlbumSharedLink {album} {sharedLink} />
              {/each}
            </Stack>
          </div>
        </div>
      {/if}
    </Stack>
  </ModalBody>
</Modal>
