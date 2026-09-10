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

/** 音乐目录（/api/music-roots MusicRootDto；mediaType 恒为 MUSIC） */
export interface MusicRoot {
  id: number
  name: string
  path: string
  enabled: boolean
  mediaType: string
  lastScanAt: string | null
  scanStatus: ScanStatus
  /** 上次扫描统计 JSON 字符串（{added,updated,missing,error}）或 null */
  lastScanStats: string | null
}

// ── 图书（M2-book，契约事实源：bifrost-core/doc/m2-book）──

/** 封面来源；null = 无封面 */
export type BookCoverSource = 'EMBEDDED' | 'UPLOADED' | null

/** 图书目录（/api/book-roots BookRootDto；mediaType 恒为 BOOK） */
export interface BookRoot {
  id: number
  name: string
  path: string
  enabled: boolean
  mediaType: string
  lastScanAt: string | null
  scanStatus: ScanStatus
}

/** 图书（/api/books BookDto） */
export interface Book {
  id: number
  title: string
  authors: string | null
  language: string | null
  publisher: string | null
  /** 出版年（仅年份，1–9999） */
  pubDate: number | null
  description: string | null
  subject: string | null
  identifier: string | null
  series: string | null
  seriesIndex: number | null
  rights: string | null
  /** EPUB | PDF */
  format: string
  extension: string
  fileSize: number
  /** ISO-8601 UTC（后端 Long epoch ms 转 Instant） */
  fileLastModified: string | null
  coverSource: BookCoverSource
  /**
   * 相对路径（渲染须拼 window.location.origin）；无封面时为 null。
   * 后端 OPDS 端点支持 ?size=N 缩略图。
   */
  coverUrl: string | null
  isAvailable: boolean
  libraryRootId: number
  createdAt: string
  updatedAt: string
}

/** 扫描触发响应（/api/book-roots/{id}/scan 或 /scan/all） */
export interface BookScanTriggerView {
  scanStatus: ScanStatus
  /** 单根扫描=该根 id；scan/all 时为 null（用 /scan/status 的 currentRootId） */
  rootId: number | null
  message: string
}

/** 全局 BOOK 扫描状态（/api/book-roots/scan/status） */
export interface BookScanStatusView {
  scanStatus: ScanStatus
  currentRootId: number | null
  startedAt: string | null
  lastScanAt: string | null
  /** 上次扫描统计 JSON 字符串（{added,updated,missing,error}）或 null */
  lastStats: string | null
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

/** 全局音乐扫描状态（/api/music-roots/scan/status） */
export interface MusicScanStatusView {
  scanning: boolean
  roots: MusicRoot[]
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
