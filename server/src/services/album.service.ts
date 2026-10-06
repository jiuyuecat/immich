import { BadRequestException, Injectable } from '@nestjs/common';
import type { Updateable } from 'kysely';
import {
  AddUsersDto,
  AlbumResponseDto,
  AlbumStatisticsResponseDto,
  AlbumsAddAssetsDto,
  AlbumsAddAssetsResponseDto,
  CreateAlbumDto,
  GetAlbumsDto,
  type MapAlbumDto,
  UpdateAlbumDto,
  UpdateAlbumUserDto,
  mapAlbum,
} from 'src/dtos/album.dto.js';
import { BulkIdErrorReason, BulkIdResponseDto, BulkIdsDto } from 'src/dtos/asset-ids.response.dto.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { MapMarkerResponseDto } from 'src/dtos/map.dto.js';
import { AlbumUserRole, Permission } from 'src/enum.js';
import { AlbumAssetCount, AlbumInfoOptions, AlbumSubtreeCount } from 'src/repositories/album.repository.js';
import { AlbumUserTable } from 'src/schema/tables/album-user.table.js';
import { BaseService } from 'src/services/base.service.js';
import { addAssets, removeAssets } from 'src/utils/asset.util.js';
import { asDateTimeString } from 'src/utils/date.js';
import { findOrFail } from 'src/utils/misc.js';
import { getPreferences } from 'src/utils/preferences.js';

@Injectable()
export class AlbumService extends BaseService {
  async getStatistics(auth: AuthDto): Promise<AlbumStatisticsResponseDto> {
    const [owned, shared, notShared] = await Promise.all([
      this.albumRepository.getAll(auth.user.id, { isOwned: true }),
      this.albumRepository.getAll(auth.user.id, { isShared: true }),
      this.albumRepository.getAll(auth.user.id, { isOwned: true, isShared: false }),
    ]);

    return {
      owned: owned.length,
      shared: shared.length,
      notShared: notShared.length,
    };
  }

  async getAll(auth: AuthDto, { assetId, parentId, rootOnly, ...rest }: GetAlbumsDto): Promise<AlbumResponseDto[]> {
    const ownerId = auth.user.id;
    await this.albumRepository.updateThumbnails();

    let albums: MapAlbumDto[];
    if (assetId) {
      albums = await this.albumRepository.getByAssetId(ownerId, assetId);
    } else if (parentId) {
      await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [parentId] });
      albums = await this.albumRepository.getChildren(ownerId, parentId);
    } else {
      albums = await this.albumRepository.getAll(ownerId, { ...rest, rootOnly });
    }

    if (albums.length === 0) {
      return [];
    }

    // Get asset count for each album. Then map the result to an object:
    // { [albumId]: assetCount }
    const albumIds = albums.map((album) => album.id);
    const [results, subtreeResults] = await Promise.all([
      this.albumRepository.getMetadataForIds(albumIds),
      this.albumRepository.getSubtreeCounts(ownerId, albumIds),
    ]);
    const albumMetadata: Record<string, AlbumAssetCount> = {};
    for (const metadata of results) {
      albumMetadata[metadata.albumId] = metadata;
    }
    const albumSubtree: Record<string, AlbumSubtreeCount> = {};
    for (const counts of subtreeResults) {
      albumSubtree[counts.albumId] = counts;
    }

    return albums.map((album) => ({
      ...mapAlbum(album),
      sharedLinks: undefined,
      startDate: asDateTimeString(albumMetadata[album.id]?.startDate ?? undefined),
      endDate: asDateTimeString(albumMetadata[album.id]?.endDate ?? undefined),
      assetCount: albumMetadata[album.id]?.assetCount ?? 0,
      subAlbumCount: albumSubtree[album.id]?.subAlbumCount ?? 0,
      assetCountTotal: albumSubtree[album.id]?.assetCountTotal ?? (albumMetadata[album.id]?.assetCount ?? 0),
      // lastModifiedAssetTimestamp is only used in mobile app, please remove if not need
      lastModifiedAssetTimestamp: asDateTimeString(albumMetadata[album.id]?.lastModifiedAssetTimestamp ?? undefined),
    }));
  }

  async get(auth: AuthDto, id: string): Promise<AlbumResponseDto> {
    await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [id] });
    await this.albumRepository.updateThumbnails();
    const album = await this.findOrFail(id, auth.user.id, { withAssets: false });
    const [[albumMetadataForIds], [albumSubtreeForId]] = await Promise.all([
      this.albumRepository.getMetadataForIds([album.id]),
      this.albumRepository.getSubtreeCounts(auth.user.id, [album.id]),
    ]);

    const hasSharedUsers = album.albumUsers && album.albumUsers.length > 1;
    const hasSharedLink = album.sharedLinks && album.sharedLinks.length > 0;
    const isShared = hasSharedUsers || hasSharedLink;

    return {
      ...mapAlbum(album),
      startDate: asDateTimeString(albumMetadataForIds?.startDate ?? undefined),
      endDate: asDateTimeString(albumMetadataForIds?.endDate ?? undefined),
      assetCount: albumMetadataForIds?.assetCount ?? 0,
      subAlbumCount: albumSubtreeForId?.subAlbumCount ?? 0,
      assetCountTotal: albumSubtreeForId?.assetCountTotal ?? (albumMetadataForIds?.assetCount ?? 0),
      lastModifiedAssetTimestamp: asDateTimeString(albumMetadataForIds?.lastModifiedAssetTimestamp ?? undefined),
      contributorCounts: isShared ? await this.albumRepository.getContributorCounts(album.id) : undefined,
    };
  }

  async getMapMarkers(auth: AuthDto, id: string): Promise<MapMarkerResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [id] });

    if (auth.sharedLink && !auth.sharedLink.showExif) {
      return [];
    }

    return this.mapRepository.getAlbumMapMarkers(id);
  }

  /** Fills in the subtree counts that `mapAlbum` cannot know about on its own. */
  private async withSubtreeCounts(userId: string, album: AlbumResponseDto): Promise<AlbumResponseDto> {
    const [counts] = await this.albumRepository.getSubtreeCounts(userId, [album.id]);
    return {
      ...album,
      subAlbumCount: counts?.subAlbumCount ?? 0,
      assetCountTotal: counts?.assetCountTotal ?? album.assetCount,
    };
  }

  async create(auth: AuthDto, dto: CreateAlbumDto): Promise<AlbumResponseDto> {
    const albumUsers = (dto.albumUsers || []).filter(({ userId }) => userId !== auth.user.id);

    for (const { userId } of albumUsers) {
      const exists = await this.userRepository.get(userId, {});
      if (!exists) {
        this.logger.debug('Album creation failed: user not found');
        throw new BadRequestException('Invalid user');
      }
    }

    const allowedAssetIdsSet = await this.checkAccess({
      auth,
      permission: Permission.AssetShare,
      ids: dto.assetIds || [],
    });
    const assetIds = [...allowedAssetIdsSet].map((id) => id);

    const userMetadata = await this.userRepository.getMetadata(auth.user.id);

    if (dto.parentAlbumId) {
      const ownedIds = await this.accessRepository.album.checkOwnerAccess(auth.user.id, new Set([dto.parentAlbumId]));
      if (!ownedIds.has(dto.parentAlbumId)) {
        throw new BadRequestException('Invalid parent album');
      }
    }

    const album = await this.albumRepository.create(
      {
        albumName: dto.albumName,
        description: dto.description,
        albumThumbnailAssetId: assetIds[0] || null,
        order: getPreferences(userMetadata).albums.defaultAssetOrder,
        parentAlbumId: dto.parentAlbumId ?? null,
      },
      assetIds,
      [{ userId: auth.user.id, role: AlbumUserRole.Owner }, ...albumUsers],
      auth.user.id,
    );

    for (const { userId } of albumUsers) {
      await this.eventRepository.emit('AlbumInvite', { id: album.id, userId, senderName: auth.user.name });
    }

    return mapAlbum(album);
  }

  async update(auth: AuthDto, id: string, dto: UpdateAlbumDto): Promise<AlbumResponseDto> {
    await this.requireAccess({ auth, permission: Permission.AlbumUpdate, ids: [id] });

    if (dto.parentAlbumId !== undefined) {
      await this.moveAlbum(auth, id, dto.parentAlbumId);
    }

    const album = await this.findOrFail(id, auth.user.id, { withAssets: true });

    if (dto.albumThumbnailAssetId) {
      const results = await this.albumRepository.getAssetIds(id, [dto.albumThumbnailAssetId]);
      if (results.size === 0) {
        throw new BadRequestException('Invalid album thumbnail');
      }
    }
    const updatedAlbum = await this.albumRepository.update(
      album.id,
      {
        id: album.id,
        albumName: dto.albumName,
        description: dto.description,
        albumThumbnailAssetId: dto.albumThumbnailAssetId,
        isActivityEnabled: dto.isActivityEnabled,
        order: dto.order,
      },
      auth.user.id,
    );

    return this.withSubtreeCounts(auth.user.id, mapAlbum({ ...updatedAlbum, assets: album.assets }));
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.AlbumDelete, ids: [id] });
    await this.albumRepository.delete(id);
  }

  private async moveAlbum(auth: AuthDto, id: string, parentAlbumId: string | null): Promise<void> {
    const idsToOwn = parentAlbumId ? [id, parentAlbumId] : [id];
    const ownedIds = await this.accessRepository.album.checkOwnerAccess(auth.user.id, new Set(idsToOwn));
    for (const ownedId of idsToOwn) {
      if (!ownedIds.has(ownedId)) {
        throw new BadRequestException('Invalid album');
      }
    }

    if (parentAlbumId) {
      if (await this.albumRepository.isInSubtree(id, parentAlbumId)) {
        throw new BadRequestException('Cannot move an album into its own sub-tree');
      }

      // keep an album's owner identical across the whole tree: otherwise deleting a parent album
      // would cascade-delete albums owned by other users
      const album = await this.findOrFail(id, auth.user.id, { withAssets: false });
      const parent = await this.findOrFail(parentAlbumId, auth.user.id, { withAssets: false });
      const albumOwner = album.albumUsers?.find(({ role }) => role === AlbumUserRole.Owner)?.user.id;
      const parentOwner = parent.albumUsers?.find(({ role }) => role === AlbumUserRole.Owner)?.user.id;
      if (albumOwner !== parentOwner) {
        throw new BadRequestException('Cannot move an album under an album owned by another user');
      }
    }

    await this.albumRepository.move(id, parentAlbumId);
  }

  async addAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    const album = await this.findOrFail(id, auth.user.id, { withAssets: false });
    await this.requireAccess({ auth, permission: Permission.AlbumAssetCreate, ids: [id] });

    const results = await addAssets(
      auth,
      { access: this.accessRepository, bulk: this.albumRepository },
      { parentId: id, assetIds: dto.ids, permission: Permission.AssetShare },
    );

    const { id: firstNewAssetId } = results.find(({ success }) => success) || {};
    if (firstNewAssetId) {
      await this.albumRepository.update(
        id,
        {
          id,
          updatedAt: new Date(),
          albumThumbnailAssetId: album.albumThumbnailAssetId ?? firstNewAssetId,
        },
        auth.user.id,
      );

      const userIds = album.albumUsers.map(({ user }) => user.id);
      const recipientIds = userIds.filter((userId) => userId !== auth.user.id);
      await this.eventRepository.emit('AlbumUpdate', { id, userIds, recipientIds });
    }

    return results;
  }

  async addAssetsToAlbums(auth: AuthDto, dto: AlbumsAddAssetsDto): Promise<AlbumsAddAssetsResponseDto> {
    const results: AlbumsAddAssetsResponseDto = {
      success: false,
      error: BulkIdErrorReason.DUPLICATE,
    };

    const allowedAlbumIds = await this.checkAccess({
      auth,
      permission: Permission.AlbumAssetCreate,
      ids: dto.albumIds,
    });
    if (allowedAlbumIds.size === 0) {
      results.error = BulkIdErrorReason.NO_PERMISSION;
      return results;
    }

    const allowedAssetIds = await this.checkAccess({ auth, permission: Permission.AssetShare, ids: dto.assetIds });
    if (allowedAssetIds.size === 0) {
      results.error = BulkIdErrorReason.NO_PERMISSION;
      return results;
    }

    const albumAssetValues: { albumId: string; assetId: string }[] = [];
    const events: { id: string; userIds: string[]; recipientIds: string[] }[] = [];
    for (const albumId of allowedAlbumIds) {
      const existingAssetIds = await this.albumRepository.getAssetIds(albumId, [...allowedAssetIds]);
      const notPresentAssetIds = [...allowedAssetIds.difference(existingAssetIds)];
      if (notPresentAssetIds.length === 0) {
        continue;
      }
      const album = await this.findOrFail(albumId, auth.user.id, { withAssets: false });
      results.error = undefined;
      results.success = true;

      for (const assetId of notPresentAssetIds) {
        albumAssetValues.push({ albumId, assetId });
      }
      await this.albumRepository.update(
        albumId,
        {
          id: albumId,
          updatedAt: new Date(),
          albumThumbnailAssetId: album.albumThumbnailAssetId ?? notPresentAssetIds[0],
        },
        auth.user.id,
      );
      const userIds = album.albumUsers.map(({ user }) => user.id);
      const recipientIds = userIds.filter((userId) => userId !== auth.user.id);
      events.push({ id: albumId, userIds, recipientIds });
    }

    await this.albumRepository.addAssetIdsToAlbums(albumAssetValues);
    for (const event of events) {
      await this.eventRepository.emit('AlbumUpdate', event);
    }

    return results;
  }

  async removeAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.AlbumAssetDelete, ids: [id] });

    const album = await this.findOrFail(id, auth.user.id, { withAssets: false });
    const results = await removeAssets(
      auth,
      { access: this.accessRepository, bulk: this.albumRepository },
      { parentId: id, assetIds: dto.ids, canAlwaysRemove: Permission.AlbumDelete },
    );

    const removedIds = results.filter(({ success }) => success).map(({ id }) => id);
    if (removedIds.length > 0) {
      if (album.albumThumbnailAssetId && removedIds.includes(album.albumThumbnailAssetId)) {
        await this.albumRepository.updateThumbnails();
      }

      await this.eventRepository.emit('AlbumUpdate', {
        id,
        userIds: album.albumUsers.map(({ user }) => user.id),
        recipientIds: [],
      });
    }

    return results;
  }

  async addUsers(auth: AuthDto, id: string, { albumUsers }: AddUsersDto): Promise<AlbumResponseDto> {
    await this.requireAccess({ auth, permission: Permission.AlbumShare, ids: [id] });

    const album = await this.findOrFail(id, auth.user.id, { withAssets: false });

    for (const { userId, role, includeSubAlbums } of albumUsers) {
      if (role === AlbumUserRole.Owner) {
        throw new BadRequestException('Cannot add another owner');
      }

      const exists = album.albumUsers.some(({ user: { id } }) => id === userId);
      if (exists) {
        continue;
      }

      const user = await this.userRepository.get(userId, {});
      if (!user) {
        this.logger.debug('Adding user to album failed: user not found');
        throw new BadRequestException('Invalid user');
      }

      await this.albumUserRepository.create({
        userId,
        albumId: id,
        role,
        includeSubAlbums,
      });
      await this.eventRepository.emit('AlbumInvite', { id, userId, senderName: auth.user.name });
    }

    return this.withSubtreeCounts(auth.user.id, mapAlbum(await this.findOrFail(id, auth.user.id, { withAssets: true })));
  }

  async removeUser(auth: AuthDto, id: string, userId: string | 'me'): Promise<void> {
    if (userId === 'me') {
      userId = auth.user.id;
    }

    const album = await this.findOrFail(id, auth.user.id, { withAssets: false });

    const exists = album.albumUsers.find(({ user: { id } }) => id === userId);
    if (!exists) {
      throw new BadRequestException('Album not shared with user');
    }

    if (
      exists.role === AlbumUserRole.Owner &&
      album.albumUsers.filter(({ role }) => role === AlbumUserRole.Owner).length === 1
    ) {
      throw new BadRequestException('Cannot remove the last album owner');
    }

    // non-admin can remove themselves
    if (auth.user.id !== userId) {
      await this.requireAccess({ auth, permission: Permission.AlbumShare, ids: [id] });
    }

    await this.albumUserRepository.delete({ albumId: id, userId });
  }

  async updateUser(auth: AuthDto, id: string, userId: string, dto: UpdateAlbumUserDto): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.AlbumShare, ids: [id] });

    const album = await this.findOrFail(id, userId, { withAssets: false });
    const owner = album.albumUsers[0];

    if (owner.user.id === userId) {
      throw new BadRequestException('User is owner');
    }

    const update: Updateable<AlbumUserTable> = { role: dto.role };
    if (dto.includeSubAlbums !== undefined) {
      update.includeSubAlbums = dto.includeSubAlbums;
    }

    await this.albumUserRepository.update({ albumId: id, userId }, update);
  }

  private findOrFail(id: string, authUserId: string, options: AlbumInfoOptions) {
    return findOrFail(() => this.albumRepository.getById(id, options, authUserId), 'Album');
  }
}
