# Bifrost Core — Management REST API Fact Sheet (for bifrost-dashboard)

Investigated repo: `E:\Dev\jianglei\bifrost-core` (`com.bifrost:bifrost:1.0.0-SNAPSHOT`, Java 21 target, Spring Boot 3.5.16), re-read **2026-09-10**.
All `/api/**` code lives in module **bifrost-api** (`com.bifrost.api`); security/filters live in **bifrost-bootstrap** (`com.bifrost.bootstrap.security`). Verbatim source paths quoted throughout.

**Coverage of this revision**: music **and** book. The music roots/scan endpoints and classes were renamed to media-prefixed names (`doc\adr\0005-media-prefixed-naming.md`, ADR-0005); the old `/api/library-roots` + `/api/scan*` paths are **gone** (HTTP 404, no aliases). The book milestone (`doc\adr\0004-book-physical-isolation.md`, M2-book) added `/api/book-roots*`, `/api/books*` and `/opds/v1.2/**`.
⚠️ 与上一版事实表的差异: 上一版记录的是改名前的 HEAD `d4f8997`（当时 `/api/library-roots`、`/api/scan` 仍在）。本版描述**媒体前缀命名整改（ADR-0005）之后**的契约：音乐根/扫描端点已更名，旧路径 404；同时补齐了此前完全缺失的图书侧端点。表内标的错误码与响应字段均按改名后的后端源码逐条核对（`mvn clean verify` + `hurl\run.ps1` 18/18 全绿）。

---

## 1. Management REST controllers — every endpoint

Controllers (all under `bifrost-api\src\main\java\com\bifrost\api\`):

| Controller            | Class path                                            |
| --------------------- | ----------------------------------------------------- |
| PingController        | `controller`-less package root: `PingController.java` |
| BrowseController      | `controller\BrowseController.java`                    |
| MusicRootController   | `controller\MusicRootController.java` (ADR-0005 rename of `LibraryRootController`) |
| BookRootController    | `controller\BookRootController.java`                  |
| BookController        | `controller\BookController.java`                      |
| BookCoverController   | `controller\BookCoverController.java`                 |
| SearchController      | `controller\SearchController.java`                    |
| PlaylistsController   | `controller\PlaylistsController.java`                 |
| AnnotationController  | `controller\AnnotationController.java`                |
| UserController        | `controller\UserController.java`                      |

### 1.1 GET /api/ping

- `PingController.java`: `@RestController`, `@GetMapping("/api/ping")` returns **plain string** `"pong"` (NOT the envelope). Exempt from auth.

### 1.2 Music roots & scan — `MusicRootController.java` (`@RequestMapping("/api/music-roots")`)

Only `mediaType == MUSIC` rows are reachable here; book roots go through `BookRootController` (§1.3). All `/{id}` routes run through the private `requireMusicRoot(id)` guard.

- **GET /api/music-roots** — no params → `ApiResponse<List<MusicRootDto>>` (`findByMediaTypeOrderByIdAsc(MUSIC)`); returns **all** music roots **including disabled** ones (id ascending), so the UI can render an "enabled" toggle round-trip. Only MUSIC rows ever appear.
- **POST /api/music-roots** — body = record declared in the controller, `MusicRootRequest(String name, String path, Boolean enabled)` (there is **no** `mediaType` field) → `ApiResponse<MusicRootDto>`. `name`/`path` are trimmed (blank/null → 400/1000 `音乐目录名称与路径不能为空`); `enabled` null → `true`; `mediaType` is **forced to MUSIC** server-side. Path uniqueness is **global** (`libraryRootRepository.findByPath(path)`, no mediaType filter, `path` is a unique column), so a path already used by a **book** root also yields 400/1004 `路径已被其他目录占用: <path>`.
- **GET /api/music-roots/{id}** → `ApiResponse<MusicRootDto>`. Errors: id absent → 404/1001 `音乐目录不存在: <id>`; id exists but is not MUSIC (e.g. a book root id) → 400/1000 `该目录非音乐类型: <name>`.
- **PATCH /api/music-roots/{id}** — body same `MusicRootRequest`; **partial update** (null/blank fields skipped), duplicate path → 400/1004; a changed `path` only takes effect on the next scan → `ApiResponse<MusicRootDto>`. **`PUT` no longer exists** — PATCH is the only update verb.
- **DELETE /api/music-roots/{id}** → `ApiResponse<Void>`; soft-hides its tracks (`isAvailable=false`, one save per track) then deletes the root row. Music delete now cascades to **tracks only** — it no longer touches books (ADR-0005 removed the old mixed cascade).
- **POST /api/music-roots/{id}/scan** — query `fullScan` (boolean, default `false`) → `ApiResponse<ScanStats>`; **synchronous**: the response returns after the scan finished and carries the final stats. Errors: another scan holds the global lock → 409/1100; root disabled → 400/1000 `音乐目录已禁用: <name>`; plus the `requireMusicRoot` errors above. `fullScan=true` forces full re-parse (ignores fingerprint skips — used to backfill tag fields).
- **POST /api/music-roots/scan/all** — query `fullScan` (default `false`) → `ApiResponse<ScanStats>`; serial over **enabled MUSIC** roots only; also synchronous; 409/1100 when a scan is already running.
- **GET /api/music-roots/scan/status** → `ApiResponse<MusicScanStatusView>` — `record MusicScanStatusView(boolean scanning, List<MusicRootDto> roots)`; `roots` = **enabled MUSIC roots only** (disabled ones are absent here even though `GET /api/music-roots` lists them), `scanning` = any of them is `SCANNING`.

**Removed paths (ADR-0005, clean break — all 404 today, no compatibility aliases)**: `GET/POST /api/library-roots`, `GET/PUT/DELETE /api/library-roots/{id}`, `POST /api/library-roots/{id}/scan`, `POST /api/scan`, `GET /api/scan/status`. Pinned by contract test: `hurl\api\errors.hurl` asserts 404 for **all six of those route shapes**.

**Class/service renames**: `LibraryRootController`→`MusicRootController`, `ScanService`→`MusicScanService`, `ScanStatusView`→`MusicScanStatusView`, `ScanCompletedEvent`→`MusicScanCompletedEvent`, `ScanStateResetRunner`→`MusicScanStateResetRunner`. **Deliberately unchanged (shared persistence)**: `LibraryRoot` entity / `library_root` table / `LibraryRootRepository`, `Track|Book.libraryRootId` FK fields, `ScanStats`, `ScanStatus`, `MediaType`.

**DTOs** (music responses are curated DTOs now, no longer the raw JPA entity — `createdAt`/`updatedAt` are gone from these payloads):

- `MusicRootDto` (`dto\music\MusicRootDto.java`): `record MusicRootDto(Long id, String name, String path, Boolean enabled, MediaType mediaType, Instant lastScanAt, ScanStatus scanStatus, String lastScanStats)`.
- `MusicScanStatusView` (`dto\music\MusicScanStatusView.java`): `record MusicScanStatusView(boolean scanning, List<MusicRootDto> roots)`.
- `lastScanStats` is a **JSON string** (`{"added":3,"updated":0,"missing":0,"error":0}`), not a nested object — parse it client-side.

`ScanStats` (`bifrost-core\src\main\java\com\bifrost\core\event\ScanStats.java`): `record ScanStats(int added, int updated, int missing, int error)` — payload shared by music and book scanning.

### 1.3 Book roots & scan — `BookRootController.java` (`@RequestMapping("/api/book-roots")`)

Mirror of §1.2 for `mediaType == BOOK` (ADR-0004 physical isolation); same shared `library_root` table, separate controller, separate lock. All `/{id}` routes run through `requireBookRoot(id)`.

- **GET /api/book-roots** — no params → `ApiResponse<List<BookRootDto>>` (`findByMediaTypeOrderByIdAsc(BOOK)`); **all** book roots including disabled, id ascending. A `?mediaType=` query param is **ignored** — the filter is hard-coded, so `/api/book-roots?mediaType=VIDEO` still returns the BOOK list (`hurl\api\book-roots.hurl` pins this).
- **POST /api/book-roots** — body = `BookRootRequest(String name, String path, Boolean enabled, MediaType mediaType)`; `name`/`path` trimmed, blank/null → 400/1000 `图书目录名称与路径不能为空`; duplicate path (global `findByPath`) → 400/1004; `enabled` null → `true`; the `mediaType` field in the body is **ignored and forced to BOOK** → `ApiResponse<BookRootDto>`.
- **GET /api/book-roots/{id}** → `ApiResponse<BookRootDto>`; id absent → 404/1001 `图书目录不存在: <id>`; id exists but not BOOK → 400/1000 `该目录非图书类型: <id>`.
- **PATCH /api/book-roots/{id}** — body `{name?, path?, enabled?}` (partial; blank skipped); duplicate path → 400/1004; `mediaType` is **not** updatable → `ApiResponse<BookRootDto>`.
- **DELETE /api/book-roots/{id}** → `ApiResponse<Void>`; cascades `Book.isAvailable=false` over `bookRepository.findByLibraryRootId(id)` then deletes the root row (book files untouched).
- **POST /api/book-roots/{id}/scan** — query `force` (boolean, default `false`) → `ApiResponse<ScanTriggerView>`; **asynchronous**: returns immediately with `{scanStatus:"SCANNING", rootId:<id>, message:"图书扫描已启动"}` while the scan runs in a `CompletableFuture`. Poll `GET /api/book-roots/scan/status`.
- **POST /api/book-roots/scan/all** — query `force` (default `false`) → `ApiResponse<ScanTriggerView>` with `rootId = null` and `message = "已启动 <N> 个图书目录扫描"`; serial over enabled BOOK roots, still async.
- **GET /api/book-roots/scan/status** → `ApiResponse<BookScanStatusView>` (declared as a nested record in `BookRootController`): `record BookScanStatusView(String scanStatus, Long currentRootId, Instant startedAt, Instant lastScanAt, String lastStats)`.
  - `scanStatus` = `"SCANNING"` if any enabled BOOK root is SCANNING else `"IDLE"`; `currentRootId` = that root's id (null when IDLE); `startedAt` = **`Instant.now()` at the moment of the status read** (not the real scan start time — do not use it as a duration baseline); `lastScanAt`/`lastStats` come from the enabled BOOK root with the newest `lastScanAt` (both null if nothing was ever scanned).
  - `ScanTriggerView` is also declared in `BookRootController`: `record ScanTriggerView(String scanStatus, Long rootId, String message)`.

`BookRootDto` (`dto\book\BookRootDto.java`): `record BookRootDto(Long id, String name, String path, Boolean enabled, MediaType mediaType, Instant lastScanAt, ScanStatus scanStatus)` — note it has **no `lastScanStats`** field (unlike `MusicRootDto`); use `BookScanStatusView.lastStats` for the last stats.

Scan-engine facts (`bifrost-core\src\main\java\com\bifrost\core\book\BookScanService.java`): own `ReentrantLock` (independent of the music scan lock, so music and book scans may overlap); `scanRoot` itself throws 409/1100 `图书扫描进行中`, 404/1001 for a missing root, and 400/1000 for a non-BOOK or **disabled** root.

> ⚠️ 与文档不一致: because the controller wraps that call in `CompletableFuture.runAsync(...)` **with its own `try/catch` + `log.warn`**, none of those errors ever reach the client — `POST /api/book-roots/{id}/scan` returns **200 + `SCANNING` even when a scan is already running or the root is disabled**. The endpoint comment ("`BookScanService` 内部 tryLock 失败 → `BizException` 1100 抛回客户端") and `doc\m2-book\task\06-前端对接.md` (which lists 1100 as a book-scan error) describe behaviour the code does not have; the only reliable signal is polling the status endpoint (and the server log).

### 1.4 Books & covers — `BookController.java` + `BookCoverController.java` (both `@RequestMapping("/api/books")`)

- **GET /api/books** — query: `page` (int, default 0; `< 0` → 400/1000 `page 必须 >= 0`), `size` (int, default 20; `< 1` → 20; `> 200` → 200, silently clamped), `title` (optional, case-insensitive LIKE `%…%`), `author` (optional, LIKE against the `authors` column), `series` (optional, LIKE), `libraryRootId` (optional Long, equals), `isAvailable` (optional Boolean, equals) → `ApiResponse<PageResult<BookDto>>`, sorted `createdAt DESC`. No `isAvailable` filter ⇒ soft-hidden (`false`) rows are returned too.
- **GET /api/books/{id}** → `ApiResponse<BookDto>`; missing → 404/1001 `图书不存在: <id>`.
- **PATCH /api/books/{id}** — body is a raw `JsonNode` validated against a whitelist → `ApiResponse<BookDto>`. Writable: `title`, `authors`, `language`, `publisher`, `pubDate`, `description`, `subject`, `identifier`, `series`, `seriesIndex`, `rights`. Any key outside that set → 400/1000 `未知字段: <key>`; the explicitly **forbidden** keys `id, filePath, fileSize, fileLastModified, fingerprint, format, extension, libraryRootId, isAvailable, coverSource, createdAt, updatedAt, starredAt, rating` → 400/1000 `字段不可写（Day-one 锁定）: <key>`. `authors` / `subject` accept a string **or** a string array (joined with `" & "` / `"; "`). Fields that are absent **or JSON `null` are skipped** (PATCH cannot clear a field to null). Metadata edits are DB-only — the file on disk is never rewritten.
- **DELETE /api/books/{id}** → `ApiResponse<Void>`; deletes the DB row only — the book **file is not deleted** and there is no cascade; missing id → 404/1001.
- **POST /api/books/{id}/cover** — `consumes = multipart/form-data`, part name `file` → `ApiResponse<Void>`. Errors (all 400/1000 unless noted): missing/empty part `file 不能为空`; content type not in `image/jpeg | image/jpg | image/png | image/gif` (case-insensitive) `仅支持 image/jpeg | image/png | image/gif`; size > 5 MB `文件超过 5MB`; decode failure `封面落盘失败`; book id missing → 404/1001. On success the image is scaled to max width 1200 and re-encoded as JPEG into `cover-source/book-{id}.jpg`, prior cover + cache are deleted first, and `coverSource` becomes `"UPLOADED"`.
- **DELETE /api/books/{id}/cover** → `ApiResponse<Void>`; removes the physical source file + cache files and sets `coverSource = null` (a later scan that re-encounters an embedded cover rewrites it automatically); missing id → 404/1001. A book whose `coverSource` is already null is a silent no-op that still returns 200.

`BookDto` (`dto\book\BookDto.java`, annotated `@JsonInclude(NON_NULL)` — **null fields are omitted from the JSON**, so treat every field as optional): `id, title, authors, language, publisher, pubDate, description, subject, identifier, series, seriesIndex, rights, format, extension, fileSize, fileLastModified, coverSource, coverUrl, isAvailable, libraryRootId, createdAt, updatedAt`.

- `format` is `EPUB | PDF`; `coverSource` is `EMBEDDED | UPLOADED | null` (`BookCoverService.EMBEDDED/UPLOADED`).
- `coverUrl` is a **relative** path `/opds/v1.2/catalog/{id}/cover`, present only when `coverSource != null` — prefix it with the origin before use.
- The DTO deliberately exposes **no** `filePath`, `fingerprint`, `rating` or `starredAt`.

### 1.5 Browse — `BrowseController.java` (`@RequestMapping("/api")`)

- **GET /api/artists** — query: `page` (int, default 0), `size` (int, default 20, max 200), `q` (optional, name filter), `indexLetter` (optional, letter filter) → `ApiResponse<PageResult<ArtistView>>`.
  - `ArtistView` (`dto\ArtistView.java`): `record ArtistView(Long id, String name, String indexLetter, long albumCount, Instant starredAt, Integer rating, Integer playCount, Instant lastPlayed)`.
- **GET /api/artists/{id}** → `ApiResponse<LibraryQueryService.ArtistDetail>`; 404/1001 if absent.
  - `ArtistDetail`: `record ArtistDetail(Artist artist, List<Album> albums)`.
- **GET /api/albums** — query: `page` (0), `size` (20), `type` (optional AlbumListType: alphabeticalByName / highest / frequent / recent / newest / starred / alphabeticalByArtist / byYear / byGenre / random), `genre`, `fromYear` (Integer), `toYear` (Integer), `artistId` (Long) → `ApiResponse<PageResult<Album>>`. Invalid type → 400/1000.
- **GET /api/albums/{id}** → `ApiResponse<LibraryQueryService.AlbumDetail>`; `AlbumDetail`: `record AlbumDetail(Album album, List<Track> tracks)`.
- **GET /api/tracks** — query: `page`, `size`, `albumId` (Long), `artistId` (Long), `q` (String) → `ApiResponse<PageResult<Track>>`.
- **GET /api/tracks/{id}** → `ApiResponse<Track>`; 404/1001.

### 1.6 Search — `SearchController.java`

- **GET /api/search** — query: `q` (required non-blank; blank → 400/1000), `size` (int, default 20) → `ApiResponse<LibraryQueryService.SearchResult>`.
  - `SearchResult`: `record SearchResult(List<Artist> artists, List<Album> albums, List<Track> tracks)` — each list capped at `size`.

### 1.7 Playlists — `PlaylistsController.java` (`@RequestMapping("/api/playlists")`)

- **GET /api/playlists** → `ApiResponse<List<Playlist>>`.
- **POST /api/playlists** — body `Map<String,String>` `{name, comment}` → `ApiResponse<Playlist>` (owner = current user).
- **GET /api/playlists/{id}** → `ApiResponse<PlaylistDetailView>`:
  - `PlaylistDetailView(Playlist playlist, List<PlaylistEntryView> entries)`; `PlaylistEntryView(Long entryId, Integer position, Track track)` (track null when missing).
- **PUT /api/playlists/{id}** — body `{name, comment}` → `ApiResponse<Playlist>`.
- **DELETE /api/playlists/{id}** → `ApiResponse<Void>`.
- **POST /api/playlists/{id}/entries** — body `Map<String,Long>` `{trackId}` (required, else 400/1000) → `ApiResponse<PlaylistEntry>` (position auto-appended; `PlaylistEntry` entity: playlistId, trackId, position).
- **DELETE /api/playlists/{id}/entries/{entryId}** → `ApiResponse<Void>` (positions re-numbered).

### 1.8 Annotation — `AnnotationController.java` (`@RequestMapping("/api")`)

- **POST /api/starred** — body record `AnnotationRequest(String type, Long id)` (`type` ∈ track|album|artist; null type/id → 400/1000) → `ApiResponse<Void>`.
- **DELETE /api/starred** — same body → `ApiResponse<Void>`.
- **PUT /api/rating** — body record `RatingRequest(String type, Long id, Integer rating)` (rating 1–5, 0 = clear; null → 400/1000) → `ApiResponse<Void>`.

### 1.9 User — `UserController.java` (`@RequestMapping("/api")`)

- **GET /api/user** → `ApiResponse<Map<String,Object>>` with keys `username` (current auth name) and `role` = `"ADMIN"`.
- **PUT /api/user/password** — body `Map<String,String>` `{oldPassword, newPassword}` (blank new → 400/1000; wrong old → 401/1002) → `ApiResponse<Void>` (re-encrypts AES-GCM).

### 1.10 Entity JSON shapes (entities returned directly — field names = JSON keys)

> Music/book root responses are the exception: they return the DTOs of §1.2/§1.3, not `LibraryRoot`. Every other entity below is still serialized as-is.

- `LibraryRoot` (`bifrost-domain\...\entity\LibraryRoot.java`): `id, createdAt, updatedAt` (from `BaseEntity`), `name, path, enabled (Boolean), mediaType ("MUSIC"|"BOOK"|"VIDEO"), lastScanAt (Instant|null), scanStatus ("IDLE"|"SCANNING"), lastScanStats (String JSON|null)`. `path` is a unique column and `mediaType` is `@Enumerated(STRING)`; no `/api` endpoint serializes this entity any more (see the DTOs in §1.2/§1.3).
- `Artist`: `id, createdAt, updatedAt, name, indexLetter, musicBrainzId, starredAt, rating, playCount, lastPlayed`.
- `Album`: `id, createdAt, updatedAt, title, artistId, albumArtistName, year, genre, coverSource, duration, playCount, lastPlayed, starredAt, rating`.
- `Track`: `id, createdAt, updatedAt, title, trackNo, discNo, artistId, artistName, albumArtistName, albumId, genre, year, duration, bitrate, sampleRate, format, filePath, fileSize, fileLastModified, fingerprint, playCount, lastPlayed, starredAt, rating, isAvailable, libraryRootId`.
- `Playlist`: `id, createdAt, updatedAt, name, ownerId, isPublic, comment`.
- `User`: `id, createdAt, updatedAt, username, encryptedPassword, role`.
- Times serialize as ISO-8601 UTC (`Instant`); `BaseEntity` uses `InstantMillisConverter` (stored as epoch millis in SQLite, JSON as ISO string).

---

## 2. Envelope & pagination (confirmed)

- **Envelope** `{code, message, data}` — `bifrost-api\...\response\ApiResponse.java`: `record ApiResponse<T>(int code, String message, T data)`; `ok(data)` → `{code:0, message:"ok", data:...}`; `error(code,message)` → `{code, message, data:null}`.
- **Pagination** `{total, items}` — `response\PageResult.java`: `record PageResult<T>(long total, List<T> items)`. Conventions (Javadoc + docs): `page` 0-based, `size` default 20 max 200. Implementations differ slightly: `/api/artists` and `/api/tracks` clamp `size` to 1…200 and treat `page < 0` as 0 (`BrowseController.paginate`); `/api/books` rejects `page < 0` with 400/1000 and clamps `size` to 1…200 (`BookController.list`); `/api/albums` passes `page`/`size` straight to the query service.
- **Errors**: `exception\GlobalExceptionHandler.java` (`@RestControllerAdvice`) — errors return **HTTP status + envelope with non-zero code** (not 200):
  - `BizException` → HTTP mapped by code: 1000/1004→400, 1001→404, 1002→401, 1003→403, 1100→409, default→500.
  - Bad request families (`MethodArgumentNotValidException`, `MissingServletRequestParameterException`, `MethodArgumentTypeMismatchException`, `HttpMessageNotReadableException`) → 400 + code 1000.
  - `NoResourceFoundException` → 404 + code 1001.
  - Unknown exception → 500 + code 1200.
- **Error codes** — `bifrost-common\...\constant\ErrorCodes.java`: `OK=0, PARAM_ERROR=1000, NOT_FOUND=1001, UNAUTHORIZED=1002, FORBIDDEN=1003, CONFLICT=1004, SCAN_IN_PROGRESS=1100, INTERNAL_ERROR=1200`; 2000+ reserved for music domain, 3000+ for video/book.
- Auth failure path is inline in the filter (see §3): HTTP 401 + envelope `{code:1002}`.

---

## 3. Auth — exactly how a browser client authenticates

- **No login endpoint, no sessions, no cookies, no CSRF.** Spring Security (`bootstrap\security\SecurityConfig.java`) defines two always-on stateless filter chains via `securityMatcher`: `/api/**` and `/rest/**`; a third chain for `/opds/**` exists only when explicitly enabled (see below). `authorizeHttpRequests` is `permitAll` on the two always-on chains — enforcement is done inside the custom filters (not Spring's auth). Both also enable CORS via `.cors(withDefaults())` (see §5 for the actual policy — it is **not** absent any more).
- **`ApiAuthenticationFilter`** (`bootstrap\security\ApiAuthenticationFilter.java`, `OncePerRequestFilter`, registered before `UsernamePasswordAuthenticationFilter`) accepts, in priority order:
  1. **t/s token** via query params: `?u=<username>&t=<token>&s=<salt>` where `token = md5(password + salt)` lowercase hex (`SubsonicTokenUtil.token()`); validated by `AuthenticationService.authenticateByToken(u,t,s)` with constant-time compare.
  2. **HTTP Basic** header: `Authorization: Basic base64(username:password)` (UTF-8); validated by `authenticateByPassword`.
- On failure: `response.setStatus(401)`, `Content-Type: application/json;charset=UTF-8`, body `{"code":1002,"message":"未认证","data":null}` (written inline by the filter, not the advice).
- Success sets `UsernamePasswordAuthenticationToken(username, null, [ROLE_ADMIN])` in `SecurityContextHolder`.
- **Exempt**: only exact URI `/api/ping` (`isExempt()`).
- **OPDS (`/opds/**`) is a separate, optional chain** — `bootstrap\security\OpdsSecurityConfig.java`, mounted only when `bifrost.opds.require-auth=true` (`@ConditionalOnProperty`). With the default `false` no chain matches `/opds/**` at all, so OPDS feeds/file/cover endpoints are **anonymous**; when enabled it reuses the same `AuthenticationService` + `ApiAuthenticationFilter` with HTTP Basic and returns `401 + WWW-Authenticate: Basic realm="Bifrost OPDS"`.
- Shared account with Subsonic; initial admin username `admin` (`bifrost.auth.initial-username`), password injected via env `BIFROST_AUTH_INITIAL_PASSWORD` on first boot, stored AES-GCM; secret key env `BIFROST_AUTH_SECRET` or auto-generated into `data/secret.key` (`AuthSecret.java`, `AdminUserInitializer.java`).
- CORS: **configured** — see §5.

---

## 4. Cover art — music is still a GAP, books are covered

### 4.1 Music (album/artist) — still no `/api` read endpoint

- **There is NO management REST endpoint serving album/artist cover images under `/api/**`.** The only cover-capable music endpoint is Subsonic:
  - `bifrost-adapter\syrinx\subsonic-api\...\SubsonicController.java` `@GetMapping({"/getCoverArt.view", "/getCoverArt"})` — params `id` (Subsonic id, `al-<albumId>` only) + optional `size`; returns `image/jpeg` bytes, or Subsonic protocol error 70 (`{"status":"failed"}` envelope in XML/JSON) when missing. Requires Subsonic auth (`u/t/s` or `p`).
- Cover sources (see `bifrost-core\...\audio\CoverService.java`): embedded artwork → `cover-source/al-<id>.jpg`; folder art `cover.jpg`/`folder.jpg` → path stored in `Album.coverSource`; thumbnails cached as `cover-cache/al-<id>-<64|200|N>.jpg` under `bifrost.media.cover-cache-dir` (`./data/covers`). `CoverService` is a core service — reusable but not currently exposed via any `/api` controller.
- **Consequence for the dashboard**: music cover thumbnails still cannot come from `/api/**`. Options (facts, not design): hit `/rest/getCoverArt.view` with Subsonic-style auth (`?u=admin&t=...&s=...&id=al-<albumId>&size=200`), or map `al-<id>` from the numeric album ids returned by `/api/albums`. Artist covers do not exist anywhere (no artist cover concept).

### 4.2 Books — write under `/api`, read under `/opds`

- **Write**: `POST /api/books/{id}/cover` (multipart upload) and `DELETE /api/books/{id}/cover` — see §1.4. Both need the normal `/api` auth.
- **Read**: `GET /opds/v1.2/catalog/{id}/cover?size=<N>` (`bifrost-adapter\opds-publisher\...\controller\OpdsController.java`) — returns `image/jpeg` with `Cache-Control: max-age=86400, public`, `size` defaults to 200 and is bucketed by `BookCoverService.thumbnail` (`≤64` → 64, `≤200` → 200, otherwise the requested width); 404 when the book is missing, `coverSource == null`, or the cached cover cannot be produced. **Anonymous by default** (see §3/§5).
  - `BookDto.coverUrl` is exactly this path (relative), present only when `coverSource != null` — prefix the origin before rendering.
- **Files/caches** (`bifrost-core\...\book\BookCoverService.java`): uploaded or extracted covers live in `cover-source/book-<id>.jpg`, thumbnails in `cover-cache/book-<id>-<size>.jpg` under `bifrost.media.cover-cache-dir` (physically separated from the music `al-<id>` files, ADR-0004). Uploads are scaled to max width 1200 and re-encoded as JPEG; `coverSource` is `EMBEDDED` (extracted by the scanner) or `UPLOADED` (user upload — a later scan will not overwrite it with an embedded cover).
- The same OPDS module also serves the book feeds and the file download endpoint with HTTP Range/206: `GET /opds/v1.2/catalog`, `/catalog/all?page=&count=` (page **1-based**, `page=0` → 400; count default 50, clamped 10–200), `/catalog/recent`, `/search.xml`, `/search?q=` (blank `q` → 400), `/catalog/{id}/file`.
- **OPDS errors are not the `/api` envelope**: the adapter's own advice (`bifrost-adapter\opds-publisher\...\OpdsExceptionHandler.java`, `@RestControllerAdvice(basePackages = "com.bifrost.adapter.opds")`) returns `application/xml;charset=UTF-8` with `<error><code>404</code><message>…</message></error>` and HTTP 404 (missing book/cover), 400 (`IllegalArgumentException`, e.g. `page=0`) or 500. The `<code>` is the **HTTP code**, not the 1000-series business code (pinned by `hurl\opds\setup.hurl`).

> ⚠️ 与文档不一致: the previous revision stated flatly that "grep of `bifrost-api` for cover/art found nothing" and that no cover endpoint exists anywhere outside Subsonic. That is now wrong for books (`BookCoverController` + the OPDS cover endpoint above); it remains true only for **album/artist** covers. `docs\adr\0001-cover-art-via-subsonic.md` on the dashboard side carries the same now-too-broad wording.

---

## 5. Runtime configuration (facts from `bifrost-bootstrap\src\main\resources\application.yml` + `bifrost-core\...\config\BifrostProperties.java`)

```yaml
spring:
  application.name: bifrost
  jpa.hibernate.ddl-auto: update
  jpa.open-in-view: false
  jpa.properties.hibernate.dialect: org.hibernate.community.dialect.SQLiteDialect
server:
  port: 18080 # no server.servlet.context-path → "/"
bifrost:
  db.path: ./data/bifrost.db
  library.roots: [] # empty by default; each root may carry name/path/enabled/mediaType
  media.cover-cache-dir: ./data/covers
  scan.cron: '0 3 * * *' # declared only — see the cron note below
  scan.batch-size: 200
  auth.initial-username: admin
  subsonic.enabled: true
  subsonic.api-version: 1.16.1
```

Keys that exist only as Java defaults in `bifrost-core\...\config\BifrostProperties.java` (absent from the packaged `application.yml`, all overridable by yml/env/args):

- `bifrost.cors.allowed-origins` (`List<String>`, default `["*"]`; an **empty list disables CORS**).
- `bifrost.opds.require-auth` (boolean, default `false` → `/opds/**` anonymous).

> ⚠️ 与上一版事实表的差异: 上一版称 "CORS: not configured anywhere"（已不成立）。`SecurityConfig` 注册了 `CorsConfigurationSource`，`/api/**` 与 `/rest/**` 两条链都 `.cors(withDefaults())`。允许方法原为 `GET, POST, PUT, DELETE, OPTIONS, HEAD`——**缺 `PATCH`**，会让跨域浏览器无法预检 `PATCH /api/music-roots/{id}` / `PATCH /api/books/{id}`；**该缺口已在本次整改中补上**（`SecurityConfig.java` 现含 `PATCH`，`AuthIntegrationTest` 新增 PATCH 预检断言）。其余仍宽松：来源默认 `*`、头 `*`、max-age 3600s、无凭据。注意 dashboard 走同源代理（`vite.config.ts`），本来就不触发预检。

- Override order: env/startup args > `SPRING_CONFIG_ADDITIONAL_LOCATION` external yml > built-in application.yml.
- DB path override: `bifrost.db.path` (property), `BIFROST_DB_PATH` (env), or `--bifrost.db.path=...`; SQLite JDBC + `hibernate-community-dialects`; `DatabaseCheckRunner` verifies read/write at startup.
- **Static frontend: not served.** `bifrost-bootstrap\src\main\resources` contains only `application.yml` + `logback-spring.xml`; no static resources, no resource-handler config. Docs note a future milestone will bundle the dashboard build into the Docker image (`整体技术架构.md` §9.1).
- **No scheduled scan is wired.** `bifrost.scan.cron` / `scan.batch-size` are read for batch sizing, but there is **no `@EnableScheduling` and no `@Scheduled` anywhere** in the repo (grep over all `.java`), so scanning happens only when triggered manually (`POST /api/music-roots/scan/all`, `POST /api/book-roots/scan/all`) or via Subsonic `startScan`. The music scan engine still serialises all triggers through one global `ReentrantLock` (409/1100 for latecomers) and the book engine through its own separate lock.

> ⚠️ 与文档不一致: the previous revision claimed "Scan cron: single `@Scheduled` daily incremental scan". No scheduler exists — `通用功能说明.md` §6.2 explicitly records the same gap ("定时扫描尚未接线 … 无 `@EnableScheduling` / `@Scheduled` 消费方").

- Tomcat (embedded) on port **18080**, context path `/` (from `application.yml`; the hurl suite also runs the jar with `--server.port=18080`). The previous revision's `8080` was stale; the dashboard now matches end to end — `src\views\SystemView.vue` displays 18080 and `vite.config.ts` proxies `/api`, `/rest`, `/opds` to `localhost:18080`.

---

## 6. hurl contract tests — representative verbatim excerpts

Directory `hurl\` (`setup.hurl`, `api\*.hurl`, `rest\*.hurl`, `opds\setup.hurl`; README documents run procedure: app on `:18080` with `data/hurl.db`, test user `admin`/`testpass`, Basic header `YWRtaW46dGVzdHBhc3M=`). `hurl\api\` = management REST contract tests: `music-roots.hurl`, `book-roots.hurl`, `books.hurl`, `books-cover.hurl`, `browse.hurl`, `playlists.hurl`, `starred-rating.hurl`, `user.hurl`, `errors.hurl`.

**`hurl\api\music-roots.hurl`** (list, capture, PATCH, scan status) — the renamed successor of `library-roots.hurl`:

```hurl
GET {{base_url}}/api/music-roots
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Captures]
root_id: jsonpath "$.data[0].id"
[Asserts]
jsonpath "$.code" == 0
jsonpath "$.data[0].name" == "测试库"
jsonpath "$.data[0].enabled" == true
# 列表只含 MUSIC 目录（图书目录走 /api/book-roots）
jsonpath "$.data[0].mediaType" == "MUSIC"
...
PATCH {{base_url}}/api/music-roots/{{root_id}}
Authorization: Basic YWRtaW46dGVzdHBhc3M=
Content-Type: application/json
{
  "name": "测试库-改名"
}
...
GET {{base_url}}/api/music-roots/scan/status
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.data.scanning" == false
jsonpath "$.data.roots[0].lastScanStats" contains "added"
```

**`hurl\api\book-roots.hurl` + `hurl\api\books.hurl` + `hurl\api\books-cover.hurl`** (the book contract; blocks below are excerpted from the three files, `Authorization` headers and intervening requests elided with `...`):

```hurl
# —— book-roots.hurl ——
GET {{base_url}}/api/book-roots
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Captures]
ebook_root_id: jsonpath "$.data[0].id"
[Asserts]
jsonpath "$.data[0].mediaType" == "BOOK"
...
# 异步扫描：立即返回 SCANNING（不是最终统计）
POST {{base_url}}/api/book-roots/{{ebook_root_id}}/scan
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.data.scanStatus" == "SCANNING"
jsonpath "$.data.rootId" == {{ebook_root_id}}
...
# —— books.hurl ——
# 列表 {total, items} + 过滤
GET {{base_url}}/api/books?page=0&size=10
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.data.total" >= 1
jsonpath "$.data.items[0].title" exists
...
# PATCH 白名单：数组 authors 用 " & " 拼接
PATCH {{base_url}}/api/books/{{first_book_id}}
Authorization: Basic YWRtaW46dGVzdHBhc3M=
Content-Type: application/json
{
  "authors": ["Array Author A", "Array Author B", "Array Author C"]
}
HTTP 200
[Asserts]
jsonpath "$.data.authors" == "Array Author A & Array Author B & Array Author C"
...
# rating 在 Day-one 锁定 → 400 + code 1000
PATCH {{base_url}}/api/books/{{first_book_id}}
Authorization: Basic YWRtaW46dGVzdHBhc3M=
Content-Type: application/json
{
  "rating": 5
}
HTTP 400
[Asserts]
jsonpath "$.code" == 1000
...
# —— books-cover.hurl ——
POST {{base_url}}/api/books/{{target_book_id}}/cover
Authorization: Basic YWRtaW46dGVzdHBhc3M=
[Multipart]
file: file,cover-test.jpg; image/jpeg
HTTP 200
[Asserts]
jsonpath "$.code" == 0
# 随后 GET /api/books/{{target_book_id}} 断言 coverSource == "UPLOADED" 且 coverUrl contains "/opds/v1.2/catalog/"
```

**`hurl\api\browse.hurl`** (pagination `{total, items}`):

```hurl
GET {{base_url}}/api/artists
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.code" == 0
jsonpath "$.data.total" == 2
...
GET {{base_url}}/api/artists/{{artist_id}}
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.data.artist.name" == "周杰伦"
jsonpath "$.data.albums[0].title" == "叶惠美"
...
GET {{base_url}}/api/search?q=%E5%91%A8%E6%9D%B0%E4%BC%A6
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.data.artists[0].name" == "周杰伦"
```

**`hurl\api\errors.hurl`** (HTTP status + envelope code):

```hurl
# 未认证 → 401 + code 1002
GET {{base_url}}/api/user
HTTP 401
[Asserts]
jsonpath "$.code" == 1002

# 资源不存在 → 404 + code 1001
GET {{base_url}}/api/albums/999999
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 404
[Asserts]
jsonpath "$.code" == 1001

# 重复目录路径 → 400 + code 1004
POST {{base_url}}/api/music-roots
Authorization: Basic YWRtaW46dGVzdHBhc3M=
Content-Type: application/json
{
  "name": "重复",
  "path": "E:/Dev/jianglei/bifrost-core/data-sample/music"
}
HTTP 400
[Asserts]
jsonpath "$.code" == 1004

# 旧普适命名端点已下线（ADR-0005 clean break）→ 404
GET {{base_url}}/api/library-roots
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 404

GET {{base_url}}/api/scan/status
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 404
```

Other files: `setup.hurl` (create root → `POST /api/music-roots`, asserting `$.data.mediaType == "MUSIC"`; then `POST /api/music-roots/{id}/scan`, asserting `$.data.added == 3`, `$.data.error == 0` — music scan is synchronous, so the stats are already final), `user.hurl` (`$.data.username == "admin"`, `$.data.role == "ADMIN"`, `/api/ping` body `"pong"`), `playlists.hurl` (create → add entry `{"trackId": N}` asserting `$.data.position == 1` → delete entry/list), `starred-rating.hurl` (`POST /api/starred {"type":"album","id":N}` → `$.data.album.starredAt != null`; `PUT /api/rating {"type":"track","id":N,"rating":4}` → `$.data.rating == 4`), `opds\setup.hurl` (creates the BOOK root + async scan, then asserts the whole OPDS surface: `catalog` navigation feed titles, `catalog/all?page=1&count=50` with retry-until-populated, `recent` carrying `rel="http://opds-spec.org/sort/new"`, `search?q=`, `search.xml` OSDD, 404 for missing cover/file, and the `count` clamps 1→10 / 9999→200 plus `page=0` → 400).

---

## 7. Docs conventions (exact)

**`doc\功能设计\通用功能说明.md`**:

- §4.1 envelope: `{"code": 0, "message": "ok", "data": {...}}` — "0 = 成功；非 0 = 业务错误"; HTTP: 200 success, 400 param, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error; codes 1000/1001/1002/1003/1004/1100/1200 with 2000+ music / 3000+ video-book reserved.
- §9.1: prefix `/api/**`, JSON UTF-8, envelope per §4.1, plural resource nouns (examples now cite `/api/music-roots`, `/api/albums`), **pagination `page` (0-based) / `size` (default 20, max 200) returning `{total, items}`**, ISO-8601 UTC times.
- §6.2 / §9.2 (scan semantics): music scan **synchronous** (`POST /api/music-roots/{id}/scan` blocks and returns final `ScanStats`), book scan **asynchronous** (returns SCANNING, poll `/api/book-roots/scan/status`); scheduled scanning not wired yet.
- §9.2 endpoint overview table lists **only** system / 音乐目录 / 音乐扫描 / 浏览 / 搜索 / 歌单 / 标注 / 账号 — it has **not** been extended with `/api/book-roots*` or `/api/books*`.
- §8.3: management REST auth = ① HTTP Basic, ② t/s token; failure 401 + envelope code 1002.
- §11: `GET /api/ping` → `pong`, Docker healthcheck.

> ⚠️ 与文档不一致: the previous revision asserted that §9.2 "exactly matches the implemented controllers". It no longer does — the book groups (§1.3/§1.4 here) are missing from that table even though they are implemented and hurl-tested.

**`doc\m2-book\task\06-前端对接.md`** (the authoritative frontend contract for the book milestone; every endpoint/field in it was re-checked against the controllers and matches, apart from the 1100 caveat in §1.3):

- §1.1–§1.4 tables for `/api/book-roots*`, `/api/books*`, `/api/books/{id}/cover`, plus worked `BookRootDto` / `BookScanStatusView` / `BookDto` JSON examples and the PATCH whitelist.
- §8 endpoint quick-reference block, including the OPDS straight links (`/opds/v1.2/catalog`, `/catalog/{id}/file`, `/catalog/{id}/cover?size=N`).
- States that all management REST needs admin Basic while OPDS is anonymous by default (`bifrost.opds.require-auth=true` forces Basic).

**`doc\技术设计\整体技术架构.md`**:

- §4 layering: common ← domain ← core ← adapter; core ← api ← bootstrap; `scanBasePackages="com.bifrost"` cross-module scan; only bootstrap packages a fat jar.
- §7 auth implementation: AES-GCM reversible password storage, Subsonic `md5(password+salt)` token, management REST Basic or t/s, failure `401 + 信封 code=1002`.
- §8: `/rest/<method>.view`, XML default + `f=json`, subsonic-response envelope, IDs `ar-/al-/tr-/pl-` + numeric PK, HTTP Range/206 streaming.
- §9.1: dev run `./mvnw -pl bifrost-bootstrap -am spring-boot:run`; Docker multi-stage, `/data` volume (db + covers + secret.key), healthcheck `/api/ping`.
- §3: module map — `bifrost-api` = "管理 RESTful Controller 层（/api/**，供 Vue Dashboard 调用）"; **jellyfin-client is still a placeholder (only `package-info.java`), but opds-publisher is now a full module** (`OpdsController`, `OpdsFeedBuilder`, `OpdsBookQueryService` + tests).

> ⚠️ 与文档不一致: `通用功能说明.md` §10.1 still describes `opds-publisher` as "占位模块（图书 OPDS 流，待定）" and `整体技术架构.md` §3 as a placeholder too; `整体技术架构.md` §9.1 also still prints `8080` for the dev run while `application.yml` says `18080`. Both are stale in the backend repo (left unfixed here — this file only).

---

## 8. Implementation status — fully implemented, not stubs

- All **10** controllers are real implementations wired to services/repositories (no `TODO`/stub bodies): Ping, Browse, MusicRoot, BookRoot, Book, BookCover, Search, Playlists, Annotation, User — plus the OPDS controller in `bifrost-adapter\opds-publisher`. Integration tests exist: `bifrost-bootstrap\src\test\java\com\bifrost\bootstrap\{ManagementApiIntegrationTest, AuthIntegrationTest, SubsonicIntegrationTest, ScanIntegrationTest, BookScanIntegrationTest, BifrostApplicationTest}.java`; surefire reports in `bifrost-bootstrap\target\surefire-reports\*.txt`.
- **No fat jar is currently built** — `bifrost-bootstrap\target\` holds `classes/`, `test-classes/`, `surefire-reports/`, `test-data/` but no `bifrost-bootstrap-1.0.0-SNAPSHOT.jar`. (The previous revision quoted a 75,778,915-byte jar; `target/` has since been cleaned.)
- **Runtime artifacts in `E:\Dev\jianglei\bifrost-core\data\`** (observed 2026-09-10; the dir is gitignored — `data/` in `.gitignore`):
  - `bifrost.db` — 86,016 bytes (SQLite; JPA `ddl-auto=update`; grew with the book tables/rows)
  - `secret.key` — 64 bytes (auto-generated AES key)
  - `covers\cover-source\book-{1,2,4,5}.jpg` + `covers\cover-cache\book-{n}-{64,200}.jpg` — book covers are cached now (the earlier "covers/ — 0 files" observation is obsolete and matched the pre-book §4 GAP); no `al-*.jpg` music cover present
  - `logs\bifrost.log` (4,783 bytes) + `logs\bifrost.2026-09-04.log` (5,796 bytes)
  - no `hurl.db` / `hurl-covers/` present right now (hurl runs recreate them; see `hurl\README.md`)
- `data-sample\` gitignored sample library referenced by hurl tests — now has both `music\` (generated by `hurl\gen-sample-music.ps1`, needs ffmpeg) and `ebook\`.

---

## Key facts for the dashboard (TL;DR)

1. Base URL `http://<host>:18080` (no context path); all management endpoints under `/api/**`, book feeds/covers under `/opds/v1.2/**`.
2. Every response is `{code, message, data}`; success `code:0`; errors use real HTTP statuses (400/401/403/404/409/500) with non-zero `code`.
3. Pagination: `?page=0&size=20` → `data: {total, items}`; `size` capped at 200 (`page` is 0-based everywhere under `/api`; OPDS uses 1-based `page` + `count`).
4. Auth: `Authorization: Basic base64(admin:<password>)` on every `/api` request except `GET /api/ping`; no login endpoint, no cookies. (Or `?u=&t=&s=` token.) `/opds/**` is anonymous unless `bifrost.opds.require-auth=true`.
5. Two parallel media trees, physically separated (ADR-0004/0005): **music** = `/api/music-roots*` + `POST /api/music-roots/{id}/scan` (**synchronous**, returns final `ScanStats`), book-root ids are rejected (400/1000); **book** = `/api/book-roots*` + `POST /api/book-roots/{id}/scan` (**asynchronous**, returns `{scanStatus:"SCANNING",rootId,message}`, poll `GET /api/book-roots/scan/status`).
6. Books: `GET /api/books` (`page,size,title,author,series,libraryRootId,isAvailable`), `GET/PATCH/DELETE /api/books/{id}`, `POST/DELETE /api/books/{id}/cover`; `PATCH` is whitelisted and **rejects `rating`/`starredAt` with 400/1000**. `BookDto` omits null fields and exposes no `filePath`.
7. Covers: **music** has no `/api` read endpoint — use `/rest/getCoverArt.view?id=al-<albumId>&size=200` (Subsonic auth) or add a backend endpoint; **books** read from `/opds/v1.2/catalog/{id}/cover?size=N` (anonymous), with `BookDto.coverUrl` giving the relative path.
8. CORS **is** configured (`bifrost.cors.allowed-origins`, default `*`) — but the allowed-method list omits `PATCH`, so cross-origin preflight for the PATCH root/book endpoints fails until the backend adds it. No static frontend serving; port 18080 serves API + OPDS only.
9. IDs across `/api` are numeric Longs; Subsonic ids are `al-<n>`/`ar-<n>`/`tr-<n>`/`pl-<n>` strings; OPDS book ids are the same numeric longs.
10. Implementation is complete and exercised by hurl + integration tests against a real running instance; no scheduled scan is wired (manual triggers only).
