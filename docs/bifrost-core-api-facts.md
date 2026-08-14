# Bifrost Core — Management REST API Fact Sheet (for bifrost-dashboard)

Investigated repo: `E:\Dev\jianglei\bifrost-core` (git clean; `com.bifrost:bifrost:1.0.0-SNAPSHOT`, Java 21 target, Spring Boot 3.5.16).
All `/api/**` code lives in module **bifrost-api** (`com.bifrost.api`); security/filters live in **bifrost-bootstrap** (`com.bifrost.bootstrap.security`). Verbatim source paths quoted throughout.

---

## 1. Management REST controllers — every endpoint

Controllers (all under `bifrost-api\src\main\java\com\bifrost\api\`):

| Controller            | Class path                                            |
| --------------------- | ----------------------------------------------------- |
| PingController        | `controller`-less package root: `PingController.java` |
| BrowseController      | `controller\BrowseController.java`                    |
| LibraryRootController | `controller\LibraryRootController.java`               |
| SearchController      | `controller\SearchController.java`                    |
| PlaylistsController   | `controller\PlaylistsController.java`                 |
| AnnotationController  | `controller\AnnotationController.java`                |
| UserController        | `controller\UserController.java`                      |

### 1.1 GET /api/ping

- `PingController.java`: `@RestController`, `@GetMapping("/api/ping")` returns **plain string** `"pong"` (NOT the envelope). Exempt from auth.

### 1.2 Library roots & scan — `LibraryRootController.java` (`@RequestMapping("/api")`)

- **GET /api/library-roots** — no params → `ApiResponse<List<LibraryRoot>>` (`libraryRootRepository.findAllByOrderByIdAsc()`)
- **POST /api/library-roots** — body `LibraryRootRequest` record: `(String name, String path, Boolean enabled)` → `ApiResponse<LibraryRoot>`. Errors: missing name/path → 400/1000 (`BizException.paramError`), duplicate path → 400/1004 (`BizException.conflict`).
- **GET /api/library-roots/{id}** — path `Long id` → `ApiResponse<LibraryRoot>`; missing → 404/1001.
- **PUT /api/library-roots/{id}** — body same `LibraryRootRequest` (partial allowed; null fields skipped) → `ApiResponse<LibraryRoot>`; duplicate path → 400/1004.
- **DELETE /api/library-roots/{id}** → `ApiResponse<Void>`; marks its tracks `isAvailable=false` (soft-hide) then deletes the root.
- **POST /api/library-roots/{id}/scan** → `ApiResponse<ScanStats>` (`scanService.scanRoot(id)`); scan in progress → 409/1100.
- **POST /api/scan** (all enabled roots, serial) → `ApiResponse<ScanStats>`.
- **GET /api/scan/status** → `ApiResponse<ScanStatusView>` where `ScanStatusView(boolean scanning, List<LibraryRoot> roots)`.

`ScanStats` (`bifrost-core\...\event\ScanStats.java`): `record ScanStats(int added, int updated, int missing, int error)`.

### 1.3 Browse — `BrowseController.java` (`@RequestMapping("/api")`)

- **GET /api/artists** — query: `page` (int, default 0), `size` (int, default 20, max 200), `q` (optional, name filter), `indexLetter` (optional, letter filter) → `ApiResponse<PageResult<ArtistView>>`.
  - `ArtistView` (`dto\ArtistView.java`): `record ArtistView(Long id, String name, String indexLetter, long albumCount, Instant starredAt, Integer rating, Integer playCount, Instant lastPlayed)`.
- **GET /api/artists/{id}** → `ApiResponse<LibraryQueryService.ArtistDetail>`; 404/1001 if absent.
  - `ArtistDetail`: `record ArtistDetail(Artist artist, List<Album> albums)`.
- **GET /api/albums** — query: `page` (0), `size` (20), `type` (optional AlbumListType: alphabeticalByName / highest / frequent / recent / newest / starred / alphabeticalByArtist / byYear / byGenre / random), `genre`, `fromYear` (Integer), `toYear` (Integer), `artistId` (Long) → `ApiResponse<PageResult<Album>>`. Invalid type → 400/1000.
- **GET /api/albums/{id}** → `ApiResponse<LibraryQueryService.AlbumDetail>`; `AlbumDetail`: `record AlbumDetail(Album album, List<Track> tracks)`.
- **GET /api/tracks** — query: `page`, `size`, `albumId` (Long), `artistId` (Long), `q` (String) → `ApiResponse<PageResult<Track>>`.
- **GET /api/tracks/{id}** → `ApiResponse<Track>`; 404/1001.

### 1.4 Search — `SearchController.java`

- **GET /api/search** — query: `q` (required non-blank; blank → 400/1000), `size` (int, default 20) → `ApiResponse<LibraryQueryService.SearchResult>`.
  - `SearchResult`: `record SearchResult(List<Artist> artists, List<Album> albums, List<Track> tracks)` — each list capped at `size`.

### 1.5 Playlists — `PlaylistsController.java` (`@RequestMapping("/api/playlists")`)

- **GET /api/playlists** → `ApiResponse<List<Playlist>>`.
- **POST /api/playlists** — body `Map<String,String>` `{name, comment}` → `ApiResponse<Playlist>` (owner = current user).
- **GET /api/playlists/{id}** → `ApiResponse<PlaylistDetailView>`:
  - `PlaylistDetailView(Playlist playlist, List<PlaylistEntryView> entries)`; `PlaylistEntryView(Long entryId, Integer position, Track track)` (track null when missing).
- **PUT /api/playlists/{id}** — body `{name, comment}` → `ApiResponse<Playlist>`.
- **DELETE /api/playlists/{id}** → `ApiResponse<Void>`.
- **POST /api/playlists/{id}/entries** — body `Map<String,Long>` `{trackId}` (required, else 400/1000) → `ApiResponse<PlaylistEntry>` (position auto-appended; `PlaylistEntry` entity: playlistId, trackId, position).
- **DELETE /api/playlists/{id}/entries/{entryId}** → `ApiResponse<Void>` (positions re-numbered).

### 1.6 Annotation — `AnnotationController.java` (`@RequestMapping("/api")`)

- **POST /api/starred** — body record `AnnotationRequest(String type, Long id)` (`type` ∈ track|album|artist; null type/id → 400/1000) → `ApiResponse<Void>`.
- **DELETE /api/starred** — same body → `ApiResponse<Void>`.
- **PUT /api/rating** — body record `RatingRequest(String type, Long id, Integer rating)` (rating 1–5, 0 = clear; null → 400/1000) → `ApiResponse<Void>`.

### 1.7 User — `UserController.java` (`@RequestMapping("/api")`)

- **GET /api/user** → `ApiResponse<Map<String,Object>>` with keys `username` (current auth name) and `role` = `"ADMIN"`.
- **PUT /api/user/password** — body `Map<String,String>` `{oldPassword, newPassword}` (blank new → 400/1000; wrong old → 401/1002) → `ApiResponse<Void>` (re-encrypts AES-GCM).

### 1.8 Entity JSON shapes (entities are returned directly — field names = JSON keys)

- `LibraryRoot` (`bifrost-domain\...\entity\LibraryRoot.java`): `id, createdAt, updatedAt` (from `BaseEntity`), `name, path, enabled (Boolean), lastScanAt (Instant|null), scanStatus ("IDLE"|"SCANNING"), lastScanStats (String JSON|null)`.
- `Artist`: `id, createdAt, updatedAt, name, indexLetter, musicBrainzId, starredAt, rating, playCount, lastPlayed`.
- `Album`: `id, createdAt, updatedAt, title, artistId, albumArtistName, year, genre, coverSource, duration, playCount, lastPlayed, starredAt, rating`.
- `Track`: `id, createdAt, updatedAt, title, trackNo, discNo, artistId, artistName, albumArtistName, albumId, genre, year, duration, bitrate, sampleRate, format, filePath, fileSize, fileLastModified, fingerprint, playCount, lastPlayed, starredAt, rating, isAvailable, libraryRootId`.
- `Playlist`: `id, createdAt, updatedAt, name, ownerId, isPublic, comment`.
- `User`: `id, createdAt, updatedAt, username, encryptedPassword, role`.
- Times serialize as ISO-8601 UTC (`Instant`); `BaseEntity` uses `InstantMillisConverter` (stored as epoch millis in SQLite, JSON as ISO string).

---

## 2. Envelope & pagination (confirmed)

- **Envelope** `{code, message, data}` — `bifrost-api\...\response\ApiResponse.java`: `record ApiResponse<T>(int code, String message, T data)`; `ok(data)` → `{code:0, message:"ok", data:...}`; `error(code,message)` → `{code, message, data:null}`.
- **Pagination** `{total, items}` — `response\PageResult.java`: `record PageResult<T>(long total, List<T> items)`. Conventions (Javadoc + docs): `page` 0-based, `size` default 20 max 200.
- **Errors**: `exception\GlobalExceptionHandler.java` (`@RestControllerAdvice`) — errors return **HTTP status + envelope with non-zero code** (not 200):
  - `BizException` → HTTP mapped by code: 1000/1004→400, 1001→404, 1002→401, 1003→403, 1100→409, default→500.
  - Bad request families (`MethodArgumentNotValidException`, `MissingServletRequestParameterException`, `MethodArgumentTypeMismatchException`, `HttpMessageNotReadableException`) → 400 + code 1000.
  - `NoResourceFoundException` → 404 + code 1001.
  - Unknown exception → 500 + code 1200.
- **Error codes** — `bifrost-common\...\constant\ErrorCodes.java`: `OK=0, PARAM_ERROR=1000, NOT_FOUND=1001, UNAUTHORIZED=1002, FORBIDDEN=1003, CONFLICT=1004, SCAN_IN_PROGRESS=1100, INTERNAL_ERROR=1200`; 2000+ reserved for music domain, 3000+ for video/book.
- Auth failure path is inline in the filter (see §3): HTTP 401 + envelope `{code:1002}`.

---

## 3. Auth — exactly how a browser client authenticates

- **No login endpoint, no sessions, no cookies, no CSRF.** Spring Security (`bootstrap\security\SecurityConfig.java`) defines two stateless filter chains via `securityMatcher`: `/api/**` and `/rest/**`. `authorizeHttpRequests` is `permitAll` for all — enforcement is done inside the custom filters (not Spring's auth).
- **`ApiAuthenticationFilter`** (`bootstrap\security\ApiAuthenticationFilter.java`, `OncePerRequestFilter`, registered before `UsernamePasswordAuthenticationFilter`) accepts, in priority order:
  1. **t/s token** via query params: `?u=<username>&t=<token>&s=<salt>` where `token = md5(password + salt)` lowercase hex (`SubsonicTokenUtil.token()`); validated by `AuthenticationService.authenticateByToken(u,t,s)` with constant-time compare.
  2. **HTTP Basic** header: `Authorization: Basic base64(username:password)` (UTF-8); validated by `authenticateByPassword`.
- On failure: `response.setStatus(401)`, `Content-Type: application/json;charset=UTF-8`, body `{"code":1002,"message":"未认证","data":null}` (written inline by the filter, not the advice).
- Success sets `UsernamePasswordAuthenticationToken(username, null, [ROLE_ADMIN])` in `SecurityContextHolder`.
- **Exempt**: only exact URI `/api/ping` (`isExempt()`).
- Shared account with Subsonic; initial admin username `admin` (`bifrost.auth.initial-username`), password injected via env `BIFROST_AUTH_INITIAL_PASSWORD` on first boot, stored AES-GCM; secret key env `BIFROST_AUTH_SECRET` or auto-generated into `data/secret.key` (`AuthSecret.java`, `AdminUserInitializer.java`).
- CORS: **none configured** (see §5).

---

## 4. Cover art — GAP (important for the dashboard)

- **There is NO management REST endpoint serving album/artist cover images under `/api/**`.** Grep of `bifrost-api\src\main\java` for cover/art found nothing; the only cover-capable endpoint is Subsonic:
  - `bifrost-adapter\syrinx\subsonic-api\...\SubsonicController.java` `@GetMapping("/getCoverArt.view")` — params `id` (Subsonic id, `al-<albumId>` only) + optional `size`; returns `image/jpeg` bytes, or Subsonic protocol error 70 (`{"status":"failed"}` envelope in XML/JSON) when missing. Requires Subsonic auth (`u/t/s` or `p`).
- Cover sources (see `bifrost-core\...\audio\CoverService.java`): embedded artwork → `cover-source/al-<id>.jpg`; folder art `cover.jpg`/`folder.jpg` → path stored in `Album.coverSource`; thumbnails cached as `cover-cache/al-<id>-<64|200|N>.jpg` under `bifrost.media.cover-cache-dir` (`./data/covers`). `CoverService` is a core service — reusable but not currently exposed via any `/api` controller.
- **Consequence**: the dashboard cannot get cover thumbnails from `/api/**` today. Options it has (facts, not design): hit `/rest/getCoverArt.view` with Subsonic-style auth (`?u=admin&t=...&s=...&id=al-<albumId>&size=200`), or map `al-<id>` from the numeric album ids returned by `/api/albums`. Artist covers do not exist anywhere (no artist cover concept).

---

## 5. Runtime configuration (facts from `bifrost-bootstrap\src\main\resources\application.yml` + `bifrost-core\...\config\BifrostProperties.java`)

```yaml
spring:
  application.name: bifrost
  jpa.hibernate.ddl-auto: update
  jpa.open-in-view: false
  jpa.properties.hibernate.dialect: org.hibernate.community.dialect.SQLiteDialect
server:
  port: 8080 # no server.servlet.context-path → "/" (log confirms "context path '/'")
bifrost:
  db.path: ./data/bifrost.db
  library.roots: [] # empty by default
  media.cover-cache-dir: ./data/covers
  scan.cron: '0 3 * * *' # daily 03:00 incremental scan; empty string disables
  scan.batch-size: 200
  auth.initial-username: admin
  subsonic.enabled: true
  subsonic.api-version: 1.16.1
```

- Override order: env/startup args > `SPRING_CONFIG_ADDITIONAL_LOCATION` external yml > built-in application.yml.
- DB path override: `bifrost.db.path` (property), `BIFROST_DB_PATH` (env), or `--bifrost.db.path=...`; SQLite JDBC + `hibernate-community-dialects`; `DatabaseCheckRunner` verifies read/write at startup.
- **CORS: not configured anywhere** — no `WebMvcConfigurer`, no `CorsFilter`, no `@CrossOrigin`, no `cors:` key in any yml (grep over all `.java/.yml/.properties`). A browser dashboard on a different origin will be blocked unless the dashboard is served same-origin (e.g., behind the same reverse proxy / embedded later) or CORS is added.
- **Static frontend: not served.** `bifrost-bootstrap\src\main\resources` contains only `application.yml` + `logback-spring.xml`; no static resources, no resource-handler config. Docs note a future milestone will bundle the dashboard build into the Docker image (`整体技术架构.md` §9.1).
- Scan cron: single `@Scheduled` daily incremental scan, mutually exclusive with manual/Subsonic-triggered scans (global lock, "scan in progress" semantics).
- Tomcat (embedded) on port 8080, context path `/` (from `application.yml` and startup log).

---

## 6. hurl contract tests — representative verbatim excerpts

Directory `hurl\` (`setup.hurl`, `api\*.hurl`, `rest\*.hurl`; README documents run procedure: app on `:18080` with `data/hurl.db`, test user `admin`/`testpass`, Basic header `YWRtaW46dGVzdHBhc3M=`).

**`hurl\api\library-roots.hurl`** (list, capture, update, scan status):

```hurl
GET {{base_url}}/api/library-roots
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Captures]
root_id: jsonpath "$.data[0].id"
[Asserts]
jsonpath "$.code" == 0
jsonpath "$.data[0].name" == "测试库"
jsonpath "$.data[0].enabled" == true
...
GET {{base_url}}/api/scan/status
Authorization: Basic YWRtaW46dGVzdHBhc3M=
HTTP 200
[Asserts]
jsonpath "$.data.scanning" == false
jsonpath "$.data.roots[0].lastScanStats" contains "added"
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

# 重复库根路径 → 400 + code 1004
POST {{base_url}}/api/library-roots
Authorization: Basic YWRtaW46dGVzdHBhc3M=
Content-Type: application/json
{
  "name": "重复",
  "path": "E:/Dev/jianglei/bifrost-core/data-sample/music"
}
HTTP 400
[Asserts]
jsonpath "$.code" == 1004
```

Other files: `setup.hurl` (create root → `POST /api/library-roots/{id}/scan`, asserts `$.data.added == 3`, `$.data.error == 0`), `user.hurl` (`$.data.username == "admin"`, `$.data.role == "ADMIN"`, `/api/ping` body `"pong"`), `playlists.hurl` (create → add entry `{"trackId": N}` asserting `$.data.position == 1` → delete entry/list), `starred-rating.hurl` (`POST /api/starred {"type":"album","id":N}` → `$.data.album.starredAt != null`; `PUT /api/rating {"type":"track","id":N,"rating":4}` → `$.data.rating == 4`).

---

## 7. Docs conventions (exact)

**`doc\功能设计\通用功能说明.md`**:

- §4.1 envelope: `{"code": 0, "message": "ok", "data": {...}}` — "0 = 成功；非 0 = 业务错误"; HTTP: 200 success, 400 param, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error; codes 1000/1001/1002/1003/1004/1100/1200 with 2000+ music / 3000+ video-book reserved.
- §9.1: prefix `/api/**`, JSON UTF-8, envelope per §4.1, plural resource nouns, **pagination `page` (0-based) / `size` (default 20, max 200) returning `{total, items}`**, ISO-8601 UTC times.
- §9.2 endpoint overview table (system/library-root/scan/browse/search/playlist/annotation/user) — exactly matches the implemented controllers in §1.
- §8.3: management REST auth = ① HTTP Basic, ② t/s token; failure 401 + envelope code 1002.
- §11: `GET /api/ping` → `pong`, Docker healthcheck.

**`doc\技术设计\整体技术架构.md`**:

- §4 layering: common ← domain ← core ← adapter; core ← api ← bootstrap; `scanBasePackages="com.bifrost"` cross-module scan; only bootstrap packages a fat jar.
- §7 auth implementation: AES-GCM reversible password storage, Subsonic `md5(password+salt)` token, management REST Basic or t/s, failure `401 + 信封 code=1002`.
- §8: `/rest/<method>.view`, XML default + `f=json`, subsonic-response envelope, IDs `ar-/al-/tr-/pl-` + numeric PK, HTTP Range/206 streaming.
- §9.1: dev run `./mvnw -pl bifrost-bootstrap -am spring-boot:run` on 8080; Docker multi-stage, `/data` volume (db + covers + secret.key), healthcheck `/api/ping`.
- §3: module map — `bifrost-api` = "管理 RESTful Controller 层（/api/**，供 Vue Dashboard 调用）"; jellyfin-client & opds-publisher are placeholders (empty src).

---

## 8. Implementation status — fully implemented, not stubs

- All 7 controllers are real implementations wired to services/repositories (no `TODO`/stub bodies). Integration tests exist: `bifrost-bootstrap\src\test\java\com\bifrost\bootstrap\{ManagementApiIntegrationTest, AuthIntegrationTest, SubsonicIntegrationTest, ScanIntegrationTest, BifrostApplicationTest}.java`; surefire reports in `bifrost-bootstrap\target\surefire-reports\*.txt`.
- Built fat jar: `bifrost-bootstrap\target\bifrost-bootstrap-1.0.0-SNAPSHOT.jar` (75,778,915 bytes).
- **Runtime artifacts in `E:\Dev\jianglei\bifrost-core\data\`** (evidence of a running instance; dir is gitignored — `data/` in `.gitignore`):
  - `bifrost.db` — 49,152 bytes (SQLite; JPA `ddl-auto=update`)
  - `secret.key` — 64 bytes (auto-generated AES key)
  - `covers/` — exists, **0 files**; `hurl-covers/` — exists, 0 files (no cover ever cached; matches the §4 GAP)
  - `logs\bifrost.log` — 116,751 bytes: multiple successful startups of the jar (Java 22.0.1 runtime), `已创建初始管理员账号: admin`, `Tomcat started on port 8080 (http) with context path '/'`, `SQLite 数据库可读写校验通过`, graceful shutdown; one startup failed with "Port 8080 was already in use" (another instance was running).
  - `hurl.db` — 49,152 bytes (hurl test database)
- `data-sample\` gitignored sample library referenced by hurl tests (generated by `hurl\gen-sample-music.ps1`, needs ffmpeg).

---

## Key facts for the dashboard (TL;DR)

1. Base URL `http://<host>:8080` (no context path); all management endpoints under `/api/**`.
2. Every response is `{code, message, data}`; success `code:0`; errors use real HTTP statuses (400/401/403/404/409/500) with non-zero `code`.
3. Pagination: `?page=0&size=20` → `data: {total, items}`; `size` capped at 200.
4. Auth: `Authorization: Basic base64(admin:<password>)` on every request except `GET /api/ping`; no login endpoint, no cookies. (Or `?u=&t=&s=` token.)
5. **No cover-image endpoint under `/api/**` — GAP.** Covers only via `/rest/getCoverArt.view?id=al-<albumId>&size=200` (Subsonic auth required), or `coverSource`-pointed files on disk.
6. No CORS configuration exists; no static frontend serving (port 8080 serves API only).
7. IDs across `/api` are numeric Longs; Subsonic ids are `al-<n>`/`ar-<n>`/`tr-<n>`/`pl-<n>` strings.
8. Implementation is complete and was exercised by hurl + integration tests against a real running instance.
