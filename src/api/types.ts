/**
 * 领域类型 —— 与 bifrost-core 管理 REST 契约一一对应
 * 契约事实源：docs/bifrost-core-api-facts.md（由后端源码勘察得出）
 */

// ── 通用信封与分页 ──

/** 统一信封 {code, message, data}；code===0 为成功 */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

/** 分页结果；page 从 0 起，size 默认 20 最大 200 */
export interface PageResult<T> {
  total: number
  items: T[]
}

// ── 实体 ──

export type ScanStatus = 'IDLE' | 'SCANNING'

export interface LibraryRoot {
  id: number
  name: string
  path: string
  enabled: boolean
  lastScanAt: string | null
  scanStatus: ScanStatus
  /** 上次扫描统计 JSON 字符串（{added,updated,missing,error}）或 null */
  lastScanStats: string | null
  createdAt: string
  updatedAt: string
}

export interface Artist {
  id: number
  name: string
  indexLetter: string
  musicBrainzId: string | null
  /** 收藏时间；null=未收藏 */
  starredAt: string | null
  /** 评分 1–5；0=无 */
  rating: number
  playCount: number
  lastPlayed: string | null
  createdAt: string
  updatedAt: string
}

/** 艺术家列表视图（含专辑数） */
export interface ArtistView {
  id: number
  name: string
  indexLetter: string
  albumCount: number
  starredAt: string | null
  rating: number
  playCount: number
  lastPlayed: string | null
}

export interface Album {
  id: number
  title: string
  artistId: number | null
  albumArtistName: string | null
  year: number | null
  genre: string | null
  coverSource: string | null
  /** 总时长（秒） */
  duration: number
  playCount: number
  lastPlayed: string | null
  starredAt: string | null
  rating: number
  createdAt: string
  updatedAt: string
}

export interface Track {
  id: number
  title: string
  trackNo: number
  discNo: number
  artistId: number | null
  artistName: string | null
  albumArtistName: string | null
  albumId: number
  genre: string | null
  year: number | null
  /** 时长（秒） */
  duration: number
  /** 码率 kbps */
  bitrate: number
  /** 采样率 Hz */
  sampleRate: number
  /** 容器格式 mp3/flac/m4a/wav */
  format: string
  filePath: string
  fileSize: number
  fileLastModified: number
  fingerprint: string
  playCount: number
  lastPlayed: string | null
  starredAt: string | null
  rating: number
  /** 文件是否仍存在；缺失=隐藏 */
  isAvailable: boolean
  libraryRootId: number
  createdAt: string
  updatedAt: string
}

export interface ArtistDetail {
  artist: Artist
  albums: Album[]
}

export interface AlbumDetail {
  album: Album
  tracks: Track[]
}

export interface SearchResult {
  artists: Artist[]
  albums: Album[]
  tracks: Track[]
}

export interface ScanStats {
  added: number
  updated: number
  missing: number
  error: number
}

export interface ScanStatusView {
  scanning: boolean
  roots: LibraryRoot[]
}

export interface Playlist {
  id: number
  name: string
  ownerId: number
  isPublic: boolean
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface PlaylistEntryView {
  entryId: number
  position: number
  /** 曲目可能为 null（缺失文件时后端保留引用） */
  track: Track | null
}

export interface PlaylistDetailView {
  playlist: Playlist
  entries: PlaylistEntryView[]
}

export interface UserView {
  username: string
  role: string
}

export type AnnotationType = 'track' | 'album' | 'artist'

/** /api/albums 的 type 参数（对应 Subsonic getAlbumList 语义） */
export type AlbumListType =
  | 'alphabeticalByName'
  | 'highest'
  | 'frequent'
  | 'recent'
  | 'newest'
  | 'starred'
  | 'alphabeticalByArtist'
  | 'byYear'
  | 'byGenre'
  | 'random'
