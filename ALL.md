# Arcadia App Audit (Screens, Features, Tech Stack, Performance)

Generated from a parallel codebase scan. Individual files are in this folder for per-topic reading; this file is a combined single doc.

## Contents

- [Screens and Navigation](#screens-and-navigation)
- [Feature Catalog](#feature-catalog)
- [Feature 001 - Game Reviews](#feature-001---game-reviews)
- [Feature 002 - Improve Review UX](#feature-002---improve-review-ux)
- [Data Layer - Appwrite (Remote)](#data-layer---appwrite-remote)
- [Data Layer - Room (Local)](#data-layer---room-local)
- [Architecture - MVVM + DI (Koin)](#architecture---mvvm--di-koin)
- [UI Theme and Design System](#ui-theme-and-design-system)
- [Tech Stack and Build](#tech-stack-and-build)
- [Performance Audit](#performance-audit-hotspots-and-fixes)
- [Tests and Quality](#tests-and-quality)

---

## Screens and Navigation

Source: `docs/audit/SCREENS.md`

### Navigation stack

- Framework: AndroidX Navigation 3 (`androidx.navigation3.runtime` + `androidx.navigation3.ui`)
- Destinations: type-safe keys (no string routes) via `@Serializable sealed interface ArcadiaDestination : NavKey`
- Host: `NavDisplay(backStack = rememberNavBackStack(...), entryProvider = { key -> when(key) { ... } })`
- Start destination: derived from `AppwriteAuthManager.isAuthenticatedSync()` and `PreferencesManager.isOnBoardingCompleted()`
- Deep links: parsed in `NavigationRoot()` and converted into a synthetic back stack

Key files:
- `app/src/main/java/com/example/arcadia/MainActivity.kt`
- `app/src/main/java/com/example/arcadia/navigation/NavigationRoot.kt`

### Top-level destinations

Auth
- Destination: `ArcadiaDestination.Auth`
- Entry: `AuthScreen(onNavigateToHome, onNavigateToProfile)`
- ViewModel: `AuthViewModel` (`koinViewModel()`)
- What it does: signs the user in (Google) and establishes an authenticated session.
- Why it’s useful: unlocks cloud-backed features (profiles, friends, reviews, realtime sync) and lets users carry data across devices.
- State: `authState`, `customer`
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/authScreen/AuthScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/authScreen/AuthViewModel.kt`

Onboarding
- Destination: `ArcadiaDestination.Onboarding`
- Entry: `OnboardingScreen(onFinish)`
- ViewModel: `OnboardingViewModel` (`koinViewModel()`)
- UI: `HorizontalPager`, drag transitions, `StarFieldBackground`
- What it does: introduces the app’s core flows and marks onboarding completion in preferences.
- Why it’s useful: reduces drop-off by explaining the “why” early and prevents repeat onboarding once completed.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/onboardingRevamp/OnboardingScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/onboardingRevamp/OnboardingViewModel.kt`

Home
- Destination: `ArcadiaDestination.Home`
- Entry: `NewHomeScreen(...)`
- ViewModel: `HomeViewModel` (`koinViewModel()`)
- UI: `Scaffold`, top/bottom bars, tab `AnimatedContent`
- What it does: acts as the main hub (home feed / discover / library entry points), surfaces friend request counts, and shows personalized content.
- What it does: acts as the main hub (home feed / discover / library entry points), surfaces friend request counts, and shows personalized content.
- Why it's useful: gives users a single place to continue where they left off and reduces navigation friction.
- Key capabilities:
  - Home feed with cache-first rendering (avoid "loading flash")
  - AI playlist recommendations via Paging 3 (when cache exists, shows instantly)
  - Discover tab for filters/recommendations (uses paging only for certain paths)
  - Library tab entrypoint into My Games
- Data and sync:
  - Home feed is fetched via IGDB and persisted to Room feed cache for offline-first re-entry.
  - AI playlist is backed by Room `cached_games` + `AIRecommendationsRemoteMediator`.
- Performance notes:
  - Collects paging once and shares `LazyPagingItems` across tabs to avoid re-collection churn.
  - ViewModel uses `runBlocking` for preload (reduces flicker but is a jank risk if Room is slow).
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/home/HomeScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/home/HomeViewModel.kt`

Search
- Destination: `ArcadiaDestination.Search(initialQuery: String? = null)`
- Entry: `SearchScreen(initialQuery, onBackClick, onGameClick)`
- ViewModel: `SearchViewModel` (`koinViewModel()`)
- UI: search, AI toggle, suggestions, results, `GameRatingSheet`
- What it does: lets users find games (with suggestions/history and an AI mode) and quickly add/rate them via the rating sheet.
- Why it's useful: makes discovery + library-building fast (search -> decide -> add) without forcing a multi-screen flow.
- Key capabilities:
  - Text search (IGDB-backed) with suggestions/history
  - AI mode: prompt -> AI suggestions -> batch name resolution to real game IDs
  - "Load more" AI suggestions while excluding already shown titles
  - Inline "In Library" badges and add-to-library actions
- Data and sync:
  - AI uses `AIRepository` + `GetAIGameSuggestionsUseCase`, then `GameNameResolver.resolveGamesByNames(...)`.
  - Text search uses `SearchGamesUseCase`.
- Performance notes:
  - Name resolution is batched to reduce N network calls.
  - Load-more guarded via `AtomicBoolean` + `Mutex` to avoid duplicate pagination requests.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/searchScreen/SearchScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/searchScreen/SearchViewModel.kt`

Analytics
- Destination: `ArcadiaDestination.Analytics`
- Entry: `AnalyticsScreen(onNavigateBack, onNavigateToSearch, onNavigateToRoast)`
- ViewModel: `AnalyticsViewModel` (`koinViewModel()`)
- What it does: shows stats and AI insights about the user's library and play taste.
- Why it's useful: turns a list of games into meaning (patterns, habits, your vibe) and supports sharing.
- Key capabilities:
  - Aggregated stats via `CalculateGamingStatsUseCase`
  - Personality label via `DetermineGamingPersonalityUseCase`
  - Streaming AI insights rendered live
  - Export/share analytics as an image (bitmap render of composables)
- Data and sync:
  - Pulls library list from `GameListRepository` and recomputes stats on emissions.
  - AI streaming via `AIRepository.analyzeGamingProfileStreaming()`.
- Performance notes:
  - Streaming updates currently update large state objects per chunk; consider throttling/splitting state.
  - Share bitmap creation + PNG compression should ideally run off the main thread for large layouts.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/analytics/AnalyticsScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/analytics/AnalyticsViewModel.kt`

Profile
- Destination: `ArcadiaDestination.Profile(userId: String? = null)`
- Entry: `ProfileScreen(...)`
- ViewModel: `ProfileViewModel` (params: `userId`)
- What it does: shows a user profile (self or other), sections/badges, and social actions (friendship state).
- Why it's useful: gives identity + context for social features (friends, reviews) and a place to curate public-facing info.
- Key capabilities:
  - Friendship button with status-aware actions (send/accept/unfriend)
  - Featured badges section (max 3) synced to profile
  - Shareable profile link (deep link)
- Data and sync:
  - Friendship status combines realtime friends + incoming + outgoing request observers.
  - Featured badges are stored as JSON on the Appwrite user row and observed via user realtime.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/profile/ProfileScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/profile/ProfileViewModel.kt`

Edit Profile
- Destination: `ArcadiaDestination.EditProfile`
- Entry: `EditProfileScreen(...)`
- ViewModel: `EditProfileViewModel`
- What it does: edits username/profile data and uploads a profile image.
- Why it’s useful: improves recognizability in social + reviews, and supports deep links to a consistent identity.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/profile/update_profile/EditProfileScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/profile/update_profile/EditProfileViewModel.kt`

My Games
- Destination: `ArcadiaDestination.MyGames(userId: String? = null, username: String? = null, scrollToGameId: Int? = null)`
- Entry: `MyGamesScreen(...)`
- ViewModel: `MyGamesViewModel` (params: `userId`)
- What it does: shows a user's library with filters, list/grid modes, and reorder; supports editing via rating sheet.
- Why it's useful: this is the core tracker loop (organize backlog, mark progress, keep ratings/reviews consistent).
- Key capabilities:
  - Status tabs (playing/want/finished/dropped/on-hold)
  - Reorder in "All" with rating-bucket aware behavior (importance renormalization)
  - Remove with undo and restore-at-index
  - Offline guardrails (block destructive writes when offline)
- Data and sync:
  - Cloud truth: Appwrite `games` table; fast local cache: Room `game_library_cache`.
  - Realtime updates apply surgical updates (0 reads on delete, 1 read on update).
- Performance notes:
  - Uses `StableGameListEntry` + stable keys to reduce recomposition.
  - Debounced reorder sync reduces network churn; VM pauses applying incoming updates while dragging.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/myGames/MyGamesScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/myGames/MyGamesViewModel.kt`

Details
- Destination: `ArcadiaDestination.Details(gameId: Int)`
- Entry: `DetailsScreen(gameId, ...)`
- ViewModel: `DetailsScreenViewModel` (params: `gameId`)
- What it does: game detail page (media/info) plus community layer: reviews, likes, friends-who-play, and community stats.
- Why it's useful: turns search results into a confident decision (learn -> compare -> add -> review), and anchors social proof.
- Key capabilities:
  - Add/edit library entry from context via `GameRatingSheet`
  - Community reviews with likes + edit/delete for your own review
  - Friend-aware ordering for reviews
  - Realtime updates for reviews (queued to avoid disruptive reshuffle)
- Data and sync:
  - Reviews: Appwrite `reviews`/`review_likes` with Room `review_cache` as offline-first cache.
  - Library membership uses cached IDs and `GameOwnershipChecker` for O(1) "in library".
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/detailsScreen/DetailsScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/detailsScreen/DetailsScreenViewModel.kt`

Roast
- Destination: `ArcadiaDestination.Roast(targetUserId: String? = null)`
- Entry: `RoastScreen(...)`
- ViewModel: `RoastViewModel` (params: `targetUserId`)
- What it does: generates a shareable AI roast of a user's gaming taste and lets them select/save badges.
- Why it's useful: boosts engagement and sharing; converts analytics into something people actually send to friends.
- Key capabilities:
  - Streaming generation (console-style) with regen confirmation
  - Badge generation + selection (max 3) and save to profile
  - Share roast text
- Data and sync:
  - Roast streaming via `AIRepository.generateRoastStreaming()`.
  - Featured badges stored on Appwrite user row and displayed on Profile.
  - Roast cache persisted locally in Room (`roast_table`) for fast re-entry.
- Performance notes:
  - Autoscroll per chunk can be expensive; throttling scroll/updates would reduce jank.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/roast/RoastScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/roast/RoastViewModel.kt`

Friends
- Destination: `ArcadiaDestination.Friends`
- Entry: `FriendsScreen(...)`
- ViewModel: `FriendsViewModel`
- What it does: friend list + add friends flow; surfaces pending request count.
- Why it's useful: makes the app social (discover via friends, compare libraries, add context to reviews).
- Key capabilities:
  - Add friends from search/QR flows
  - Reciprocal request detection (if they already requested you)
  - Limit handling (daily request cap, pending-outgoing cap, friends cap)
  - OneSignal notifications for request/accept
- Data and sync:
  - Appwrite tables: `friendships` and `friendRequests` with realtime updates.
  - Friends list is cache-first (Room friends cache), while requests are currently realtime/network.
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/friends/FriendsScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/friends/FriendsViewModel.kt`

Friend Requests
- Destination: `ArcadiaDestination.FriendRequests`
- Entry: `FriendRequestsScreen(...)`
- ViewModel: `FriendRequestsViewModel`
- What it does: manages incoming/outgoing requests with accept/decline/cancel flows.
- Why it's useful: prevents social friction by keeping the pending social work in one place.
- Key capabilities:
  - Incoming/outgoing tabs
  - Accept creates bidirectional friendships
  - Decline uses a declined state for cooldown tracking
  - Cancel deletes outgoing request (404 treated as already cancelled)
- Files: `app/src/main/java/com/example/arcadia/presentation/screens/friends/FriendRequestsScreen.kt`, `app/src/main/java/com/example/arcadia/presentation/screens/friends/FriendRequestsViewModel.kt`

---

## Feature Catalog

This is the app-level feature set (what users experience), mapped to the main screens and the core data flow.

Library Tracking (core loop)
- What it does: lets users build and maintain a personal game library with status, rating, hours, and optional review.
- Why it's useful: turns "random games I played" into an organized backlog, progress tracker, and memory log.
- Where: `ArcadiaDestination.MyGames`, `ArcadiaDestination.Search`, `ArcadiaDestination.Details`, Home Library tab.
- Data: Appwrite `games` table (cloud truth) + Room `game_library_cache` (fast local cache) with realtime updates.

Statuses + Ratings + Editing (rating sheet)
- What it does: a single bottom sheet (`GameRatingSheet`) to add/update status, rating, review text, hours, and aspects.
- Why it's useful: reduces UI friction; users can edit from anywhere without losing context.
- Where: Search results, Details, My Games.
- Data: persists through `GameListRepositoryImpl.updateGameEntry()`; also triggers review sync when review text changes.

Undo for destructive actions
- What it does: remove-from-library uses a timed undo snackbar; undo restores at the original list index.
- Why it's useful: prevents accidental data loss and encourages faster, less anxious editing.
- Where: My Games and other library surfaces using `UndoableViewModel`.

Reordering (importance within rating buckets)
- What it does: users can drag to reorder; within the same rating bucket it renormalizes `importance`, cross-bucket swaps rating/importance.
- Why it's useful: supports personal "tier list" ordering without losing the meaning of rating buckets.
- Where: My Games "All" tab.
- Data: importance updates are debounced and retried with backoff.

Discovery (non-AI feeds)
- What it does: home feed and discovery pages from IGDB-backed queries with cache-first behavior.
- Why it's useful: gives users new games to add even before AI has enough signal.
- Where: Home/Discover tabs.
- Data: Room cached feed membership + cached game rows, stale-while-revalidate.

AI Recommendations (paged)
- What it does: generates personalized recommendations using the user's library and feedback loop; served via Paging 3.
- Why it's useful: reduces decision fatigue and makes discovery feel "made for me".
- Where: Home tab (AI playlist) and parts of Discover.
- Data: `AIRecommendationsRemoteMediator` writes to Room `cached_games` and uses `ai_recommendation_remote_keys` to avoid unnecessary refresh.

AI Search (suggestions)
- What it does: AI mode suggests games based on a prompt; names are batch-resolved to real IGDB entries.
- Why it's useful: users can describe a vibe instead of remembering exact titles.
- Where: Search.

Friends + Social layer
- What it does: friend list, friend requests, profile friendship state; notifications via OneSignal.
- Why it's useful: adds context and trust ("my friend plays this", "this review is from someone I follow").
- Where: Friends, Friend Requests, Profile, Details (friend reviews first).
- Data: Appwrite `friendRequests` + `friendships` tables; realtime-driven updates; partial Room caching for friends.

Community Reviews
- What it does: write/read reviews, like reviews, and get realtime updates.
- Why it's useful: helps users decide and preserves personal thoughts.
- Where: Details (reviews section), rating sheet.

Analytics (stats)
- What it does: aggregates library stats (counts, hours, completion, top genres/platforms, trends).
- Why it's useful: turns the library into insights and motivates maintenance (finishing games, balancing genres).
- Where: Analytics; also surfaced as smaller cards in My Games/Profile.

AI Insights (streaming)
- What it does: streams a narrative analysis of the user's profile using AI (chunked streaming text).
- Why it's useful: makes analytics feel human and shareable.
- Where: Analytics.

Roast + Badges
- What it does: generates a shareable roast and AI-generated badges; users select up to 3 featured badges saved to profile.
- Why it's useful: engagement + identity; converts stats into something people actually share.
- Where: Roast, Profile (badges section).

Sharing / Export
- What it does: share profile links, share roast text, and export analytics as an image.
- Why it's useful: growth loop and easy flexing.
- Where: Profile top bar, Analytics share action, Roast share.


---

## Feature 001 - Game Reviews

Source: `docs/audit/FEATURE_001_GAME_REVIEWS.md`

Note: this feature lives inside the `:app` module.

### Purpose

- Add a rating + written review for a game in your library
- Show community reviews per game (offline-first via Room cache)
- Like/unlike reviews (optimistic UI)
- Receive near-real-time review updates via Appwrite Realtime

### Why it’s useful

- Reviews turn your library into a memory log (why you rated it that way).
- Community reviews and likes provide social proof and help users decide before adding/buying.
- Offline-first caching keeps review browsing fast even on poor connections.

### What users can do (concrete)

- Publish a review by writing text in the rating sheet (save also updates the library entry).
- Edit your review (same flow) and see the edited indicator in the UI.
- Like/unlike other reviews with instant UI feedback (optimistic).
- See friends-first ordering in the review list (friend reviews float to the top).
- Get realtime updates without the list constantly reshuffling (pending updates banner).

### Primary flows

View Details + Community Reviews
- Entry: `app/src/main/java/com/example/arcadia/presentation/screens/detailsScreen/DetailsScreen.kt`
- `DetailsScreenViewModel.observeReviews()` collects Room first, then refreshes via Appwrite.
- UI shows "Updated Xm ago" based on last sync timestamp.

Write or Edit Review
- UI: `app/src/main/java/com/example/arcadia/presentation/components/game_rating/GameRatingSheet.kt`
- Save path: `DetailsScreenViewModel.saveGameEntry()` -> `GameListRepositoryImpl.updateGameEntry()` -> `ReviewRepository.syncMyReviewToAppwrite(...)` / `deleteMyReviewFromAppwrite(...)`

Delete review
- Trigger: overflow menu on your own `ReviewCard`
- VM deletes from Appwrite, clears local review text, refreshes community reviews.

Like / Unlike (optimistic)
- UI -> `DetailsScreenViewModel.onLikeClick(review)` -> `ReviewRepository.toggleLike(review)`
- Room optimistic update via `ReviewDao.updateLikeState`, rollback on error.

Realtime review updates
- Subscribes to Appwrite Realtime for `reviews`.
- VM can queue updates to avoid disruptive reorder.

### Data sources

Appwrite
- Tables: `reviews`, `review_likes`; reads `users` for avatar
- Upsert relies on unique (gameId, authorId)
- Ordering: `likeCount desc`, then `$updatedAt desc`

Room
- DB: `GameCacheDatabase` v20 (destructive migration)
- Tables: `review_cache`, `review_like_cache`
- TTL: `CacheTTLConfig.REVIEWS_TTL_MS` (1 hour)

### DI

- `reviewModule` provides `ReviewRemoteDataSource`, `ReviewDao`, `ReviewRepository`

### Performance notes

- TTL-based refresh skip reduces Appwrite reads
- Room replace-per-game is transactional
- Likes are optimistic
- Avatars use Coil 3

---

## Feature 002 - Improve Review UX

Source: `docs/audit/FEATURE_002_IMPROVE_REVIEW_UX.md`

### UX changes

- Expand/collapse review body
- Avatar/name navigation to profile
- Rating pill badge (gradient)
- Relative timestamps + edited indicator
- Trust cue: "Updated X ago" (ticks every minute)
- Realtime updates are queued and applied on user action to avoid disruptive reorder

### Why it’s useful

- Expand/collapse keeps the list scannable while still letting power users read long reviews.
- Avatar navigation makes social context immediate (who wrote this, what else they like).
- Relative timestamps + “edited” indicators increase trust.
- Non-disruptive realtime avoids janky list reshuffles while still keeping content fresh.

### Extra implementation detail (why it matters)

- Expansion uses `animateContentSize`, so it preserves accessibility semantics (no manual layout hacks).
- Likes are optimistic and animated, so the UI feels instant even on slow networks.
- The "Updated X ago" ticker builds trust in cached content (users can see how fresh it is).

### Implementation details

- Expansion uses `Modifier.animateContentSize(spring(...))`.
- Like uses scale/tint animations + burst effect.
- Loading shimmer uses `rememberInfiniteTransition` + gradient brush.
- VM adds `pendingReviews` and `hasPendingUpdates` to `DetailsUiState`.

### Performance / recomposition notes

- Missing `key(review.id)` around review items risks state being re-associated after reorder.
- Reviews rendered in `Column`; "See all" can compose full list.
- Realtime-triggered refresh can no-op due to TTL (no force refresh).

---

## Data Layer - Appwrite (Remote)

Source: `docs/audit/DATA_APPWRITE_REMOTE.md`

Why it exists (value)
- Appwrite provides cloud persistence for profiles, friends, library, reviews, and enables realtime updates so screens stay fresh without manual refresh.
- Centralized error classification + idempotent helpers keep the app resilient under flaky networks.

### Appwrite client and auth

- `AppwriteAuthManager` owns the Appwrite client and manages sessions.
- Session persistence uses encrypted preferences (fallback to regular prefs).

### Collections / tables

- `users`, `games`, `friendRequests`, `friendships`, storage bucket `profile-images`
- Reviews tables: `reviews`, `review_likes`

### Remote data source pattern

- Uses `callbackFlow` with Appwrite Realtime subscriptions.
- `SyncManager` coordinates cache-first behavior.

### Error handling

- Central `AppwriteErrorHandler` maps retryable vs non-retryable errors.
- Idempotency patterns: tolerate 404 on deletes, handle 409 on upserts/likes.

### Performance / ANR risk notes

- Some `callbackFlow` work may execute in collector context; if collected on Main, risk of jank.
- Friends realtime refetch strategy can be bursty.
- OkHttp rate-limit interceptor uses `Thread.sleep(...)`.
- Cronet interceptor init uses `runBlocking { cronetDeferred.await() }`.

---

## Data Layer - Room (Local)

Source: `docs/audit/DATA_ROOM_LOCAL.md`

Why it exists (value)
- Room acts as the local truth for cacheable data so the UI stays fast and usable offline.
- Paging 3 reads from Room first, which improves scroll performance and reduces network chatter.

### Databases

- `GameCacheDatabase` v20 (cache, destructive migration)
- `StudioCacheDatabase` v2 (cache, destructive migration, `StudioListConverter`)

### Entities and indices (high-signal)

- `CachedGameEntity` has no indices but is used in paging
- `GameLibraryCacheEntity` has indices on ownerId/gameId/igdbId
- `ReviewCacheEntity` has indices on gameId/authorId/(gameId, likeCount)
- `ReviewLikeCacheEntity` PK is (reviewId, userId)

### Performance notes

- Add indices for paging and common filters where tables can grow:
  - `cached_games`: (isAIRecommendation, aiRecommendationOrder)
  - `review_like_cache`: index on userId
  - `home_feed_cache`: (feedCategory, feedOrder)

---

## Architecture - MVVM + DI (Koin)

Source: `docs/audit/ARCH_DI_MVVM.md`

Why it exists (value)
- MVVM + StateFlow keeps UI state predictable and testable (events -> ViewModel -> state -> UI).
- Koin centralizes construction of repositories/clients and makes feature wiring consistent across screens.

### Koin initialization

- Initialized via AndroidX Startup (`KoinInitializer`).
- Modules are split into critical (sync) and feature (lazy) sets.

### Boundary leaks / anti-patterns

- Some ViewModels depend on data-layer types directly (Auth/Search/Details).
- Domain mapping lives under `data.remote.mapper` but is used by presentation.
- `NavigationRoot` creates `PreferencesManager` directly instead of DI.

### Stability risk

- Lazy module loading can race: `utilModule` depends on ImageLoader binding provided in a lazy module.

---

## UI Theme and Design System

Source: `docs/audit/UI_THEME_DESIGN_SYSTEM.md`

Why it exists (value)
- A consistent token set (colors/typography/dimensions) prevents screens from drifting visually and keeps accessibility behaviors consistent.
- Expressive motion improves perceived performance (transitions feel intentional, not jarring).

- `ArcadiaTheme` uses Material3 + Expressive motion.
- Hard-coded dark color scheme; dynamic color disabled.
- Additional tokens in `Color.kt` (surfaces, rating gradients, onboarding colors).
- Typography mostly defaults; adds `Typography.arcadiaHeadline` with BebasNeue.
- Responsive spacing via `rememberResponsiveDimens()`.

---

## Tech Stack and Build

Source: `docs/audit/TECH_STACK_BUILD.md`

Why it exists (value)
- Compose + Material3 enables a modern UI with good accessibility defaults and fast iteration.
- Baseline profiles and profileinstaller improve cold start and scroll performance in production builds.

- Modules: `:app`, `:baselineProfile`
- Toolchain: Gradle 9.1.0, AGP 9.0.0, Kotlin 2.3.0, Java 21
- Android: compileSdk 36, minSdk 28, targetSdk 36, release minify/shrink, ABI splits
- Key libs: Compose, Material3, Navigation3, Koin, Room, Paging, Appwrite, Coil 3, Retrofit 3 + OkHttp 4.12.0 (forced), Media3, OneSignal, CameraX/MLKit, Cronet, Baseline Profile

---

## Performance Audit (Hotspots and Fixes)

Source: `docs/audit/PERFORMANCE_AUDIT.md`

Why this matters
- The biggest risks are main-thread blocking (jank/ANR) and high-frequency recomposition (battery + dropped frames).
- Fixing a small set of hotspots (runBlocking, missing keys, scroll-driven effects, realtime debounce) usually yields outsized wins.

- Main-thread blocking: `runBlocking` in `HomeViewModel` init and `MyGamesViewModel` reorder paths.
- Dispatcher risks: default Main usage in `launchWithKey` + missing `flowOn` around heavy transformations.
- Scroll effects: scroll-driven `LaunchedEffect` restarts frequently (prefer `snapshotFlow`).
- Loops: periodic `while(true)` in `SearchField`.
- Paging triggers: load-more logic inside composed items (prefer list-state based triggers).
- Missing keys in lazy lists.
- Realtime refetch storms (friends/profile/reviews).

---

## Tests and Quality

Source: `docs/audit/TESTS_QUALITY.md`

Why this matters
- The app has complex realtime + caching behavior; regression tests and basic CI protect against subtle state bugs and performance regressions.

- Unit tests: only a few IGDB DSL tests + templates.
- Instrumentation tests: templates.
- Baseline profiles: present with UiAutomator flows; generated artifacts appear committed.
- CI/static analysis: no workflows and no Detekt/ktlint/Spotless configs found.
