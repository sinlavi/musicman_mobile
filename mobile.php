<?php
if (file_exists(__DIR__ . '/config.php')) require __DIR__ . '/config.php';

$MM = [
    'base_path'     => '',
    'site_name'     => 'MusicMan',
    'default_title' => 'MusicMan — Music Player',
    'default_desc'  => 'Listen to and download music — artists, albums, and tracks.',
    'default_image' => '/assets/og-default.jpg',
    'default_kw'    => 'music, download, mp3, artist, album, track, MusicMan',
    'api_base'      => 'https://3rah.ir/mm/api',
    'api_token'     => defined('API_TOKEN') ? API_TOKEN : 'change_me_to_a_secure_token',
    'api_timeout'   => 5,
];

if (defined('BASE_URL') && BASE_URL) {
    $__u = parse_url(BASE_URL, PHP_URL_PATH);
    $MM['base_path'] = ($__u === null || $__u === false || $__u === '/') ? '' : rtrim($__u, '/');
}

$__base  = $MM['base_path'];
$__req   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$__scope = ($__base ?: '') . '/';

if ($__req === $__base . '/sw.js') {
    header('Content-Type: application/javascript; charset=utf-8');
    header('Service-Worker-Allowed: ' . $__scope);
    header('Cache-Control: no-cache, no-store, must-revalidate');
    ?>const MM_CACHE = 'mm-shell-v14';
const MM_SHELL = [
  '<?= $__scope ?>',
  '<?= $__scope ?>manifest.json',
  '<?= $__scope ?>icon.svg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(MM_CACHE);
    await Promise.allSettled(MM_SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== MM_CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('<?= $__scope ?>api/')) return;
  if (url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        caches.open(MM_CACHE).then(c => c.put('<?= $__scope ?>', copy)).catch(() => {});
        return res;
      } catch {
        const c = await caches.open(MM_CACHE);
        const cached = (await c.match('<?= $__scope ?>')) || (await c.match(req));
        if (cached) return cached;
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(MM_CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
<?php
    exit;
}

if ($__req === $__base . '/manifest.json' || $__req === $__base . '/manifest.webmanifest') {
    header('Content-Type: application/manifest+json; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo json_encode([
        'name' => 'MusicMan', 'short_name' => 'MusicMan',
        'description' => 'Listen to and download music — artists, albums, and tracks.',
        'start_url' => $__scope, 'scope' => $__scope,
        'display' => 'standalone', 'orientation' => 'any',
        'background_color' => '#0b0b0d', 'theme_color' => '#0b0b0d',
        'categories' => ['music', 'entertainment'],
        'icons' => [
            ['src' => $__scope . 'icon.svg', 'sizes' => 'any', 'type' => 'image/svg+xml', 'purpose' => 'any'],
            ['src' => $__scope . 'icon.svg', 'sizes' => 'any', 'type' => 'image/svg+xml', 'purpose' => 'maskable'],
        ],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($__req === $__base . '/icon.svg') {
    header('Content-Type: image/svg+xml; charset=utf-8');
    header('Cache-Control: public, max-age=31536000, immutable');
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b2ff7"/><stop offset="1" stop-color="#f107a3"/></linearGradient></defs><rect width="512" height="512" rx="96" fill="url(#g)"/><path fill="#fff" d="M340 96c-6 0-12 1-17 3l-138 46c-12 4-20 15-20 28v187c-8-4-18-7-28-7-27 0-49 20-49 44s22 44 49 44 49-20 49-44V205l112-37v155c-8-4-18-7-28-7-27 0-49 20-49 44s22 44 49 44 49-20 49-44V124c0-15-12-28-29-28z"/></svg>';
    exit;
}

function mm_parse_url($basePath) {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = urldecode($path);
    if ($basePath !== '' && strpos($path, $basePath) === 0) $path = substr($path, strlen($basePath));
    $path = trim($path, '/');
    if ($path === '') return [null, null];
    $parts = explode('/', $path);
    if (count($parts) < 2) return [null, null];
    $type = $parts[0];
    if (!in_array($type, ['artist', 'track', 'collection', 'album'], true)) return [null, null];
    if ($type === 'album') $type = 'collection';
    $clean = '';
    foreach (str_split($parts[1]) as $c) if (ctype_alnum($c) || $c === '_' || $c === '-') $clean .= $c;
    return $clean === '' ? [null, null] : [$type, $clean];
}

function mm_pick_artwork($item, $preferPx = 600) {
    if (!empty($item['attachments']['artworkUrls']) && is_array($item['attachments']['artworkUrls'])) {
        $best = null; $bestPx = -1;
        foreach ($item['attachments']['artworkUrls'] as $a) {
            if (empty($a['url'])) continue;
            $px = (int) filter_var($a['size'] ?? '0', FILTER_SANITIZE_NUMBER_INT);
            if ($px > $bestPx) { $bestPx = $px; $best = $a['url']; }
        }
        if ($best) return preg_replace('~/\d+x\d+(bb)?\.~', "/{$preferPx}x{$preferPx}bb.", $best);
    }
    $art = $item['artworkUrl100'] ?? '';
    return $art ? str_replace(['100x100', '60x60', '30x30'], '600x600', $art) : '';
}

function mm_fetch_item($type, $id, $cfg) {
    $entity = $type === 'artist' ? 'musicArtist' : ($type === 'track' ? 'song' : 'album');
    $url = rtrim($cfg['api_base'], '/') . '/lookup?id=' . urlencode($id) . '&entity=' . $entity;
    $headers = ['Accept: application/json', 'User-Agent: MusicMan-SEO/1.0'];
    if (!empty($cfg['api_token'])) $headers[] = 'Authorization: Bearer ' . $cfg['api_token'];
    $body = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $cfg['api_timeout'], CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_FOLLOWLOCATION => true, CURLOPT_HTTPHEADER => $headers]);
        $body = curl_exec($ch); curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => $cfg['api_timeout'], 'method' => 'GET', 'header' => implode("\r\n", $headers) . "\r\n", 'ignore_errors' => true]]);
        $body = @file_get_contents($url, false, $ctx);
    }
    if (!$body) return null;
    $data = json_decode($body, true);
    if (!is_array($data) || empty($data['results'][0])) return null;
    return $data['results'][0];
}

function mm_jsonld($type, $item, $url) {
    $name = $item['trackName'] ?? $item['collectionName'] ?? $item['artistName'] ?? '';
    $artist = $item['artistName'] ?? '';
    $art = mm_pick_artwork($item);
    if ($type === 'track') {
        $d = ['@context' => 'https://schema.org', '@type' => 'MusicRecording', 'name' => $name, 'url' => $url];
        if ($artist) $d['byArtist'] = ['@type' => 'MusicGroup', 'name' => $artist];
        if (!empty($item['collectionName'])) $d['inAlbum'] = ['@type' => 'MusicAlbum', 'name' => $item['collectionName']];
        if (!empty($item['trackTimeMillis'])) $d['duration'] = 'PT' . (int) floor($item['trackTimeMillis'] / 1000) . 'S';
        if ($art) $d['image'] = $art;
    } elseif ($type === 'collection') {
        $d = ['@context' => 'https://schema.org', '@type' => 'MusicAlbum', 'name' => $name, 'url' => $url];
        if ($artist) $d['byArtist'] = ['@type' => 'MusicGroup', 'name' => $artist];
        if ($art) $d['image'] = $art;
        if (!empty($item['releaseDate'])) $d['datePublished'] = $item['releaseDate'];
        if (!empty($item['trackCount'])) $d['numTracks'] = (int) $item['trackCount'];
    } else {
        $d = ['@context' => 'https://schema.org', '@type' => 'MusicGroup', 'name' => $name, 'url' => $url];
        if (!empty($item['primaryGenreName'])) $d['genre'] = $item['primaryGenreName'];
        if ($art) $d['image'] = $art;
    }
    return json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function mm_hydration_payload($item) {
    if (!$item) return null;
    return [
        'wrapperType' => $item['wrapperType'] ?? null, 'trackId' => $item['trackId'] ?? null, 'collectionId' => $item['collectionId'] ?? null,
        'artistId' => $item['artistId'] ?? null, 'trackName' => $item['trackName'] ?? null, 'collectionName' => $item['collectionName'] ?? null,
        'artistName' => $item['artistName'] ?? null, 'artworkUrl100' => $item['artworkUrl100'] ?? null, 'primaryGenreName' => $item['primaryGenreName'] ?? null,
        'releaseDate' => $item['releaseDate'] ?? null, 'trackCount' => $item['trackCount'] ?? null, 'trackTimeMillis' => $item['trackTimeMillis'] ?? null,
        'trackNumber' => $item['trackNumber'] ?? null,
        'lyrics' => $item['lyrics'] ?? ($item['attachments']['lyrics'] ?? null),
        'attachments' => ['artworkUrls' => $item['attachments']['artworkUrls'] ?? [], 'previewUrls' => $item['attachments']['previewUrls'] ?? [], 'audioUrls' => $item['attachments']['audioUrls'] ?? []],
    ];
}

list($seoType, $seoId) = mm_parse_url($MM['base_path']);
$seoItem = ($seoType && $seoId) ? mm_fetch_item($seoType, $seoId, $MM) : null;
$seoTitle = $MM['default_title']; $seoDesc = $MM['default_desc']; $seoImage = $MM['default_image'];
$seoKeywords = $MM['default_kw']; $seoOgType = 'website'; $seoUrl = '';

if ($seoItem) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $seoUrl = $scheme . '://' . $host . $MM['base_path'] . '/' . $seoType . '/' . rawurlencode($seoId);
    $name = $seoItem['trackName'] ?? $seoItem['collectionName'] ?? $seoItem['artistName'] ?? '';
    $artist = $seoItem['artistName'] ?? '';
    $art = mm_pick_artwork($seoItem);
    if ($art) $seoImage = $art;
    if ($seoType === 'track') {
        $seoTitle = $name . ($artist ? ' — ' . $artist : '') . ' · ' . $MM['site_name'];
        $seoDesc = 'Listen to "' . $name . '"' . ($artist ? ' by ' . $artist : '') . (!empty($seoItem['collectionName']) ? ' from the album "' . $seoItem['collectionName'] . '"' : '') . ' — free streaming and offline download on MusicMan.';
        $seoOgType = 'music.song';
        $seoKeywords = $name . ', ' . $artist . ', song, mp3, music, download';
    } elseif ($seoType === 'collection') {
        $year = !empty($seoItem['releaseDate']) ? date('Y', strtotime($seoItem['releaseDate'])) : '';
        $seoTitle = $name . ($artist ? ' — ' . $artist : '') . ($year ? " ({$year})" : '') . ' · ' . $MM['site_name'];
        $seoDesc = 'Listen to the album "' . $name . '"' . ($artist ? ' by ' . $artist : '') . ($year ? " ({$year})" : '') . (!empty($seoItem['trackCount']) ? ' — ' . $seoItem['trackCount'] . ' tracks.' : '.') . ' Download & stream on MusicMan.';
        $seoOgType = 'music.album';
        $seoKeywords = $name . ', ' . $artist . ', ' . $year . ', album, mp3, download';
    } else {
        $genre = $seoItem['primaryGenreName'] ?? '';
        $seoTitle = $name . ' · ' . $MM['site_name'];
        $seoDesc = 'Listen to music by ' . $name . ($genre ? " ({$genre})" : '') . ' on MusicMan.';
        $seoOgType = 'music.musician';
        $seoKeywords = $name . ', ' . $genre . ', artist, music';
    }
}
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, maximum-scale=1">
<meta name="theme-color" content="#0b0b0d">
<meta name="color-scheme" content="dark light">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MusicMan">
<title><?= $e($seoTitle) ?></title>
<meta name="description" content="<?= $e($seoDesc) ?>">
<meta name="keywords" content="<?= $e($seoKeywords) ?>">
<meta name="robots" content="index, follow">
<meta name="author" content="<?= $e($MM['site_name']) ?>">
<?php if ($seoUrl): ?><link rel="canonical" href="<?= $e($seoUrl) ?>"><?php endif; ?>
<meta property="og:site_name" content="<?= $e($MM['site_name']) ?>">
<meta property="og:type" content="<?= $e($seoOgType) ?>">
<meta property="og:title" content="<?= $e($seoTitle) ?>">
<meta property="og:description" content="<?= $e($seoDesc) ?>">
<meta property="og:image" content="<?= $e($seoImage) ?>">
<meta property="og:image:width" content="600"><meta property="og:image:height" content="600">
<meta property="og:locale" content="en_US">
<?php if ($seoUrl): ?><meta property="og:url" content="<?= $e($seoUrl) ?>"><?php endif; ?>
<?php if ($seoType === 'track' && $seoItem): ?>
<?php if (!empty($seoItem['artistName'])): ?><meta property="music:musician" content="<?= $e($seoItem['artistName']) ?>"><?php endif; ?>
<?php if (!empty($seoItem['collectionName'])): ?><meta property="music:album" content="<?= $e($seoItem['collectionName']) ?>"><?php endif; ?>
<?php if (!empty($seoItem['trackTimeMillis'])): ?><meta property="music:duration" content="<?= (int) floor($seoItem['trackTimeMillis'] / 1000) ?>"><?php endif; ?>
<?php endif; ?>
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= $e($seoTitle) ?>">
<meta name="twitter:description" content="<?= $e($seoDesc) ?>">
<meta name="twitter:image" content="<?= $e($seoImage) ?>">
<?php if ($seoItem): ?>
<script type="application/ld+json"><?= mm_jsonld($seoType, $seoItem, $seoUrl ?: '/') ?></script>
<?php else: ?>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebSite","name":"<?= $e($MM['site_name']) ?>","url":"<?= $e(((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')) ?>"}
</script>
<?php endif; ?>

<link rel="manifest" href="<?= $e($__scope) ?>manifest.json">
<link rel="icon" type="image/svg+xml" href="<?= $e($__scope) ?>icon.svg">
<link rel="apple-touch-icon" href="<?= $e($__scope) ?>icon.svg">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">

<script>
(function(){
  try {
    var hc = navigator.hardwareConcurrency || 4;
    var dm = navigator.deviceMemory || 4;
    var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var low = (hc <= 4 && dm <= 4) || hc <= 2 || dm <= 2 || rm;
    if (low) document.documentElement.classList.add('low-end');
  } catch(e){}
})();
</script>

<style>
:root{
  --mm-ease: cubic-bezier(.32,.72,0,1);
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bot: env(safe-area-inset-bottom, 0px);
  --mm-r-sm: 8px; --mm-r-md: 12px; --mm-r-lg: 16px;
  --mm-surface: rgba(var(--bs-body-color-rgb),.035);
  --mm-surface-2: rgba(var(--bs-body-color-rgb),.055);
  --mm-surface-3: rgba(var(--bs-body-color-rgb),.09);
  --mm-divider: rgba(var(--bs-body-color-rgb),.07);
  --mm-shadow-2: 0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.05);
  --mm-shadow-3: 0 4px 14px rgba(0,0,0,.13), 0 1px 3px rgba(0,0,0,.06);
  --mm-shadow-4: 0 10px 34px rgba(0,0,0,.20), 0 2px 8px rgba(0,0,0,.10);
  --mm-preview: #38bdf8;
  --mm-preview-rgb: 56,189,248;
}
*{ box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html,body{ height:100%; }
body{
  margin:0; height:100dvh;
  display:flex; flex-direction:column; overflow:hidden;
  overscroll-behavior:none; -webkit-font-smoothing: antialiased;
  -webkit-user-select:none; user-select:none;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  letter-spacing:-.005em;
}
input, textarea, [contenteditable="true"]{
  -webkit-user-select: text !important;
  user-select: text !important;
  pointer-events: auto !important;
}
a{ text-decoration:none; color:inherit; }
.min-w-0{ min-width:0; }
button i.bi{ line-height: 1; display:inline-block; }

html.low-end .app-bar,
html.low-end .app-bottom,
html.low-end .seg,
html.low-end .search-wrap,
html.low-end .full-player,
html.low-end .offcanvas,
html.low-end .fp-bg{
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
html.low-end .app-bar,
html.low-end .app-bottom,
html.low-end .seg,
html.low-end .search-wrap{
  background: var(--bs-body-bg);
}
html.low-end *{
  animation-duration: .001s !important;
  animation-iteration-count: 1 !important;
}
html.low-end .q-bars span{
  animation: none !important;
  opacity: .75;
  height: 60% !important;
}
html.low-end .fp-bg{
  filter: none !important;
  opacity: .15 !important;
  inset: 0 !important;
}

/* ════════ TOP BAR ════════ */
.app-bar{
  flex:0 0 auto; display:flex; align-items:center; gap:8px;
  padding: calc(var(--safe-top) + 8px) 12px 8px;
  background: rgba(var(--bs-body-bg-rgb),.92);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border-bottom: 1px solid var(--mm-divider);
  z-index:20;
  contain: layout style paint;
}
.app-bar .brand{
  display:flex; align-items:center; gap:8px;
  font-weight:800; font-size:1.02rem; letter-spacing:-.02em;
}
.app-bar .brand i{ color: var(--bs-primary); font-size:1.35rem; }
.app-bar .page-title{
  font-size:.95rem; font-weight:700;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}

/* ════════ MAIN ════════ */
.app-main{
  flex:1 1 auto; overflow-y:auto; overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
  overscroll-behavior-y:contain;
  contain: layout style paint;
}
.app-main::-webkit-scrollbar{ display:none; }

/* ════════ BOTTOM STACK ════════ */
.app-bottom{
  flex:0 0 auto; padding-bottom: var(--safe-bot);
  background: rgba(var(--bs-body-bg-rgb),.9);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-top: 1px solid var(--mm-divider);
  z-index:20;
  contain: layout style paint;
}
.mini{ position:relative; cursor:pointer; }
.mini-progress{ height:2px; background: rgba(var(--bs-body-color-rgb),.13); }
.mini-progress > div{ height:100%; width:0; background: var(--bs-primary); transition: width .2s linear; }
.mini-row{ display:flex; align-items:center; gap:10px; padding:8px 12px; }
.mini-art{ width:44px; height:44px; border-radius:10px; object-fit:cover; flex: 0 0 auto; background: rgba(var(--bs-body-color-rgb),.08); }
.mini-title{ font-size:.83rem; font-weight:700; line-height:1.25; }
.mini-sub{ font-size:.72rem; color: var(--bs-secondary-color); line-height:1.25; }

.tabbar{ display:flex; }
.tabbar a{
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:2px; padding:7px 0 8px; position:relative;
  color: var(--bs-secondary-color); font-size:.66rem; font-weight:600;
  transition: color .15s;
}
.tabbar a i{ font-size:1.28rem; line-height:1; }
.tabbar a.active{ color: var(--bs-primary); }
.tab-badge{
  position:absolute; top:2px; left:50%; margin-left:10px;
  min-width:16px; height:16px; padding:0 4px;
  border-radius:99px; background: var(--bs-primary); color:#fff;
  font-size:.6rem; font-weight:700; line-height:16px; text-align:center;
  display:none;
}
.tab-badge.on{ display:inline-block; }

/* ════════ ICON BUTTONS ════════ */
.icon-btn{
  display:inline-flex; align-items:center; justify-content:center;
  width:38px; height:38px; flex:0 0 auto;
  border:0; background:transparent; color:var(--bs-body-color);
  border-radius:50%; font-size:1.12rem; padding:0;
  transition: background .15s, color .15s, transform .1s;
  cursor:pointer;
}
.icon-btn:active{ background: rgba(var(--bs-body-color-rgb),.1); transform: scale(.94); }
.icon-btn.sm{ width:32px; height:32px; font-size:.95rem; }
.icon-btn.lg{ width:54px; height:54px; font-size:1.7rem; }
.icon-btn.liked{ color: var(--bs-danger); }
.icon-btn.on{ color: var(--bs-primary); }
.icon-btn i{ line-height:1; }

.pill-btn{
  display:inline-flex; align-items:center; gap:6px;
  border:0; border-radius:999px; padding:9px 18px;
  font-size:.83rem; font-weight:700; line-height:1;
  background: rgba(var(--bs-body-color-rgb),.09); color: var(--bs-body-color);
  transition: transform .1s, background .15s, filter .15s;
  cursor:pointer;
  white-space:nowrap;
}
.pill-btn:active{ transform: scale(.96); }
.pill-btn > i{ font-size:1em; line-height:1; }
.pill-btn.primary{ background: var(--bs-primary); color:#fff; }
.pill-btn.primary:hover{ filter: brightness(1.08); }
.pill-btn.success{ background: var(--bs-success); color:#fff; }
.pill-btn.success:hover{ filter: brightness(1.06); }
.pill-btn.warn{ background: rgba(var(--bs-warning-rgb),.15); color: var(--bs-warning); }
.pill-btn.danger{ background: rgba(var(--bs-danger-rgb),.15); color: var(--bs-danger); }
.pill-btn.info{ background: rgba(var(--bs-info-rgb),.16); color: var(--bs-info); }
.pill-btn.preview{ background: rgba(var(--mm-preview-rgb),.16); color: var(--mm-preview); }
.pill-btn.preview:hover{ filter: brightness(1.08); }
.pill-btn.sm{ padding:6px 12px; font-size:.75rem; }
.pill-btn[disabled]{ opacity:.5; pointer-events:none; }

/* ════════ BADGE CHIPS ════════ */
.badge-chip{
  display:inline-flex; align-items:center; gap:4px;
  font-size:.58rem; font-weight:800; letter-spacing:.06em;
  text-transform:uppercase;
  padding: 2px 6px; border-radius: 4px;
  flex: 0 0 auto;
  white-space: nowrap;
  vertical-align: middle;
  line-height: 1.3;
}
.badge-chip.preview{ background: rgba(var(--mm-preview-rgb),.16); color: var(--mm-preview); }
.badge-chip.crawled{ background: rgba(var(--bs-success-rgb),.16); color: var(--bs-success); }
.badge-chip.crawling{ background: rgba(var(--bs-info-rgb),.16); color: var(--bs-info); }
.badge-chip > .spinner-border{ width:10px !important; height:10px !important; border-width:2px !important; }

/* ════════ SECTION / CARD ════════ */
.sec-title{
  font-size:.7rem; font-weight:800; letter-spacing:.1em;
  text-transform:uppercase; color: var(--bs-secondary-color);
  padding:20px 16px 10px; margin:0;
}
.sec-title.tight{ padding-top:12px; }
.hscroll{
  display:flex; gap:12px; overflow-x:auto; padding:0 0 4px;
  scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}
.hscroll::-webkit-scrollbar{ display:none; }
.hscroll > *{ scroll-snap-align:start; flex:0 0 auto; }

.card-item{ width:138px; display:block; padding-left:15px;}
.card-art{
  width:138px; height:138px; border-radius:14px; object-fit:cover; display:block;
  background: rgba(var(--bs-body-color-rgb),.07);
  box-shadow: 0 4px 16px rgba(0,0,0,.18);
}
.card-art-ph{ display:flex; align-items:center; justify-content:center; color: var(--bs-secondary-color); font-size:3rem; }
.card-name{ font-size:.82rem; font-weight:700; margin-top:8px; }
.card-sub{ font-size:.72rem; color:var(--bs-secondary-color); }

.artist-item{ width:104px; display:block; text-align:center; padding-left:15px;}
.artist-art{
  width:104px; height:104px; border-radius:50%; object-fit:cover; display:block;
  background: linear-gradient(145deg, rgba(var(--bs-primary-rgb),.28), rgba(var(--bs-primary-rgb),.08));
}
.artist-art-ph{ display:flex; align-items:center; justify-content:center; color: var(--bs-primary); font-size:2.6rem; }

/* ════════ TRACK ROW ════════ */
.row-item{
  display:flex; align-items:center; gap:6px;
  padding:6px 8px; border-radius:12px;
  transition: background .15s;
  contain: layout style;
}
.row-item.playing{ background: rgba(var(--bs-primary-rgb),.09); }
.row-play{
  width:42px; height:42px; flex: 0 0 auto;
  border:0; border-radius:50%;
  background: rgba(var(--bs-body-color-rgb),.09);
  color: var(--bs-body-color);
  display:flex; align-items:center; justify-content:center;
  font-size:1.35rem; padding:0;
  transition: background .15s, transform .1s;
  cursor:pointer;
}
.row-play:has(.bi-play-circle){
    background: rgba(var(--mm-preview-rgb),.16);
  color: var(--mm-preview);
}
.row-play:active{ transform: scale(.92); background: rgba(var(--bs-primary-rgb),.2); }
.row-play.playing{ background: var(--bs-primary); color:#fff; }
.row-info{
  display:flex; align-items:center; gap:10px;
  flex:1 1 auto; min-width:0;
  padding:4px 2px;
}
.row-info:active{ opacity:.72; }
.row-art{
  width:46px; height:46px; border-radius:10px; object-fit:cover; flex: 0 0 auto;
  background: rgba(var(--bs-body-color-rgb),.07);
}
.row-art-ph{ display:flex; align-items:center; justify-content:center; color: var(--bs-secondary-color); font-size:1.1rem; }
.row-title{ font-size:.83rem; font-weight:700; line-height:1.3; }
.row-sub{ font-size:.72rem; color:var(--bs-secondary-color); line-height:1.3; }

/* ════════ DOWNLOAD ROW ════════ */
.dl-row{
  display:flex; align-items:center; gap:10px;
  padding:9px 12px; border-radius:12px;
  transition: background .15s;
  contain: layout style;
}
.dl-row + .dl-row{ margin-top:2px; }
.dl-row:active{ background: rgba(var(--bs-body-color-rgb),.05); }
.dl-body{ flex:1; min-width:0; }
.dl-title{ font-size:.83rem; font-weight:700; line-height:1.3; }
.dl-sub{ font-size:.7rem; color:var(--bs-secondary-color); line-height:1.3; margin-top:1px; }
.dl-progress{
  height:4px; border-radius:99px; margin-top:6px;
  background: rgba(var(--bs-body-color-rgb),.12); overflow:hidden;
}
.dl-progress > div{ height:100%; background: var(--bs-primary); border-radius:99px; transition: width .4s ease; }
.dl-progress.saving > div{ background: var(--bs-info); }
.dl-progress.error > div{ background: var(--bs-danger); }
.dl-status{
  font-size:.62rem; font-weight:800; letter-spacing:.05em;
  text-transform:uppercase; padding:2px 6px; border-radius:6px;
}
.dl-status.queued{ background: rgba(var(--bs-secondary-rgb),.2); color: var(--bs-secondary-color); }
.dl-status.crawling{ background: rgba(var(--bs-info-rgb),.18); color: var(--bs-info); }
.dl-status.saving{ background: rgba(var(--bs-info-rgb),.18); color: var(--bs-info); }
.dl-status.error{ background: rgba(var(--bs-danger-rgb),.18); color: var(--bs-danger); }
.dl-status.ready{ background: rgba(var(--bs-warning-rgb),.18); color: var(--bs-warning); }

/* ════════ SKELETON ════════ */
.sk{
  background: linear-gradient(90deg,
    rgba(var(--bs-body-color-rgb),.055) 25%,
    rgba(var(--bs-body-color-rgb),.11) 37%,
    rgba(var(--bs-body-color-rgb),.055) 63%);
  background-size: 400% 100%;
  animation: sk 1.5s ease infinite;
  border-radius: 10px;
}
html.low-end .sk{ animation: none; background: rgba(var(--bs-body-color-rgb),.06); }
@keyframes sk{ 0%{background-position:100% 50%} 100%{background-position:0 50%} }

/* ════════ STATE ════════ */
.state{ text-align:center; padding:56px 24px; color:var(--bs-secondary-color); }
.state > i{ font-size:3rem; display:block; margin-bottom:14px; opacity:.55; }
.state p{ margin:0; font-size:.88rem; }
.state .pill-btn i, .state .icon-btn i, .state button i{ font-size:1em; display:inline; margin:0; opacity:1; }

/* ════════ SEG TABS ════════ */
.seg{
  display:flex; gap:4px; padding:10px 12px;
  position:sticky; top:0; z-index:10;
  background: rgba(var(--bs-body-bg-rgb),.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--mm-divider);
}
.seg a{
  flex:1; text-align:center; padding:9px 3px; border-radius:10px;
  font-size:.72rem; font-weight:700; color: var(--bs-secondary-color);
  background: rgba(var(--bs-body-color-rgb),.05);
  transition: all .15s; position:relative;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.seg a.active{ background: var(--bs-primary); color:#fff; }
.seg .seg-badge{
  display:none; position:absolute; top:1px; right:3px;
  min-width:15px; height:15px; padding:0 4px;
  border-radius:99px; background: var(--bs-info); color:#fff;
  font-size:.55rem; font-weight:700; line-height:15px;
}
.seg .seg-badge.on{ display:inline-block; }

/* ════════ SEARCH ════════ */
.search-wrap{
  position:sticky; top:0; z-index:30;
  padding:10px 12px;
  background: rgba(var(--bs-body-bg-rgb),.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--mm-divider);
}
.search-wrap form{ position: relative; }
.search-box{
  display:flex; align-items:center; gap:8px;
  background: rgba(var(--bs-body-color-rgb),.07);
  border-radius:12px; padding:0 12px;
  transition: box-shadow .15s, background .15s;
}
.search-box:focus-within{
  background: rgba(var(--bs-body-color-rgb),.1);
  box-shadow: 0 0 0 2px rgba(var(--bs-primary-rgb),.35);
}
.search-box i{ color: var(--bs-secondary-color); font-size:1rem; }
.search-box input{
  flex:1; border:0; background:transparent; outline:none;
  padding:11px 0; font-size:.9rem; color:var(--bs-body-color); min-width:0;
}
.search-box input::placeholder{ color: var(--bs-secondary-color); }
.search-box input::-webkit-search-cancel-button{ display:none; }
.filter-row{
  display:flex; gap:6px; overflow-x:auto; padding:8px 12px 4px;
  scrollbar-width:none;
}
.filter-row::-webkit-scrollbar{ display:none; }
.chip{
  flex:0 0 auto; border:0; border-radius:99px;
  padding:6px 14px; font-size:.75rem; font-weight:700;
  background: rgba(var(--bs-body-color-rgb),.07); color:var(--bs-body-color);
  transition: all .15s; cursor:pointer;
}
.chip.on{ background: var(--bs-primary); color:#fff; }

/* ════════ SEARCH SUGGEST ════════ */
.search-suggest{
  position: absolute;
  top: calc(100% + 8px);
  left: 0; right: 0;
  background: var(--bs-body-bg);
  border-radius: 14px;
  box-shadow: var(--mm-shadow-4), 0 0 0 1px rgba(var(--bs-body-color-rgb),.06);
  padding: 6px;
  z-index: 200;
  max-height: min(65vh, 440px);
  overflow-y: auto;
  display: none;
  contain: layout style paint;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.search-suggest.show{ display: block; animation: sgIn .14s var(--mm-ease); }
@keyframes sgIn{ from{ opacity:0; transform: translateY(-4px); } to{ opacity:1; transform: translateY(0); } }
html.low-end .search-suggest.show{ animation: none; }
.sg-item{
  display:flex; align-items:center; gap:12px;
  padding: 11px 12px; border-radius: 10px;
  border:0; background:transparent; width:100%; text-align:left;
  color: var(--bs-body-color); cursor:pointer;
  transition: background .1s;
}
.sg-item:active, .sg-item.active{ background: rgba(var(--bs-body-color-rgb),.08); }
.sg-item.active{ background: rgba(var(--bs-primary-rgb),.13); }
.sg-icon{
  width: 22px; flex: 0 0 auto; text-align: center;
  color: var(--bs-secondary-color); font-size:1rem;
}
.sg-item.active .sg-icon,
.sg-item:active .sg-icon{ color: var(--bs-primary); }
.sg-title{
  font-size:.86rem; font-weight:600; line-height:1.25;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.sg-title b{ color: var(--bs-primary); font-weight:800; }
.sg-badge{
  font-size:.58rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase;
  padding: 3px 7px; border-radius: 5px;
  background: rgba(var(--bs-body-color-rgb),.09); color: var(--bs-secondary-color);
  flex: 0 0 auto;
}
.sg-loading, .sg-empty{
  padding: 14px; font-size:.8rem; color: var(--bs-secondary-color);
  display:flex; align-items:center; gap:8px; justify-content:center;
}

/* ════════ FULL PLAYER ════════ */
.full-player{
  position:fixed; inset:0; z-index:1080;
  display:flex; flex-direction:column;
  background: var(--bs-body-bg);
  transform: translateY(100%); opacity:0; pointer-events:none;
  transition: transform .36s var(--mm-ease), opacity .22s ease;
  padding-top: var(--safe-top); padding-bottom: var(--safe-bot);
  overflow:hidden;
}
.full-player.show{ transform:translateY(0); opacity:1; pointer-events:auto; }
.fp-bg{
  position:absolute; inset:-25%; background-size:cover; background-position:center;
  filter: blur(80px) saturate(1.7); opacity:.36; z-index:0; pointer-events:none;
  transition: background-image .35s ease;
}
.fp-scrim{
  position:absolute; inset:0; z-index:0; pointer-events:none;
  background: linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.55));
}
[data-bs-theme="light"] .fp-scrim{
  background: linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,.85));
}
.fp-inner{ position:relative; z-index:1; display:flex; flex-direction:column; height:100%; overflow:hidden; }

.fp-head{ display:flex; align-items:center; gap:4px; padding:6px 8px 2px; flex:0 0 auto; }
.fp-head-tabs{
  display:flex; gap:2px; flex:1; min-width:0; justify-content:center;
  background: rgba(var(--bs-body-color-rgb),.06);
  border-radius:10px; padding:3px; max-width:320px; margin:0 auto;
}
.fp-head-tab{
  flex:1; min-width:0;
  display:flex; align-items:center; justify-content:center; gap:6px;
  border:0; background:transparent; color: var(--bs-secondary-color);
  font-size:.72rem; font-weight:800;
  padding: 7px 8px; border-radius:8px;
  cursor:pointer; transition: background .15s, color .15s;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.fp-head-tab.active{
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  box-shadow: 0 1px 2px rgba(0,0,0,.10);
}
.fp-head-tab i{ font-size:.95rem; flex: 0 0 auto; }
.fp-head-tab .rs-badge{
  min-width:16px; height:16px; padding:0 5px; border-radius:99px;
  background: var(--bs-primary); color:#fff; font-size:.58rem; font-weight:800;
  line-height:16px; text-align:center; display:none;
}
.fp-head-tab .rs-badge.on{ display:inline-block; }

.fp-tabbody{
  flex:1 1 auto; overflow-y:auto; overflow-x:hidden; min-height:0;
  scrollbar-width:none;
  padding: 4px 0 30px;
  contain: layout style paint;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.fp-tabbody::-webkit-scrollbar{ display:none; }

.fp-body{ display:flex; flex-direction:column; justify-content:center; padding: 0 26px; min-height:100%; }
.fp-art{
  width:100%; max-width:310px; aspect-ratio:1;
  margin:0 auto; border-radius:20px; object-fit:cover;
  background: rgba(var(--bs-body-color-rgb),.08);
  box-shadow: 0 22px 60px rgba(0,0,0,.45);
}
.fp-art-ph{ display:flex; align-items:center; justify-content:center; color: var(--bs-secondary-color); font-size:5rem; }
.fp-meta{ margin-top:20px; text-align:center; }
.fp-title{ font-size:1.16rem; font-weight:800; line-height:1.3; letter-spacing:-.015em; }
.fp-artist{ font-size:.85rem; color:var(--bs-secondary-color); margin-top:4px; }
.fp-artist a:hover{ text-decoration: underline; }
.fp-seek{ margin-top:16px; }
.fp-times{ display:flex; justify-content:space-between; font-size:.68rem; color:var(--bs-secondary-color); font-variant-numeric: tabular-nums; margin-top:2px; }
.fp-controls{ display:flex; align-items:center; justify-content:space-between; margin-top:12px; }
.fp-play{
  width:66px; height:66px; border-radius:50%; border:0;
  background: var(--bs-primary); color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:2rem; padding:0; transition: transform .12s;
  box-shadow: 0 8px 24px rgba(var(--bs-primary-rgb),.4);
  cursor:pointer;
}
.fp-play:active{ transform: scale(.93); }
.fp-play i{ line-height:1; display:block; padding-left:2px; }
.fp-play i.bi-pause-fill{ padding-left:0; }
.fp-volume{ display:flex; align-items:center; gap:10px; margin-top:16px; padding:0 4px; }
.fp-volume i{ font-size:.9rem; color: var(--bs-secondary-color); flex: 0 0 auto; }
.fp-actions{ display:flex; justify-content:center; gap:8px; margin-top:16px; flex-wrap:wrap; }

.fp-list-head{
  display:flex; align-items:center; gap:6px; padding:6px 14px 6px 18px;
  border-bottom: 1px solid var(--mm-divider); flex:0 0 auto;
}
.fp-list-title{
  font-size:.66rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
  color: var(--bs-secondary-color);
}
.fp-list-actions{ margin-left:auto; display:flex; gap:2px; }

.q-row{
  display:flex; align-items:center; gap:10px;
  padding:7px 12px 7px 8px; border-radius:12px; transition: background .13s;
  cursor:pointer;
  contain: layout style;
}
.q-row:active{ background: rgba(var(--bs-body-color-rgb),.07); }
.q-row.active{ background: rgba(var(--bs-primary-rgb),.13); }
.q-row.active .row-title{ color: var(--bs-primary); }
.q-row .q-drag{
  display:flex; flex-direction:column; gap:0; flex:0 0 auto;
  width:20px; opacity:.7;
}
.q-row .q-drag button{
  border:0; background:transparent; color:var(--bs-secondary-color);
  width:20px; height:16px; padding:0; border-radius:4px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
}
.q-row .q-drag button:disabled{ opacity:.2; }
.q-row .q-drag button i{ font-size:.7rem; }
.q-row .row-art{ width:40px; height:40px; }

.q-bars { display:inline-flex; align-items:flex-end; gap:2px; height:14px; flex: 0 0 auto; }
.q-bars span { width:2px; background: var(--bs-primary); border-radius:1px; transform-origin:bottom; animation: eqbar .9s ease-in-out infinite; }
.q-bars span:nth-child(1) { height:40%; animation-delay:-.6s; }
.q-bars span:nth-child(2) { height:100%; animation-delay:-.4s; }
.q-bars span:nth-child(3) { height:60%; animation-delay:-.2s; }
.q-bars span:nth-child(4) { height:80%; animation-delay:0s; }
@keyframes eqbar { 0%,100%{ transform:scaleY(.35); } 50%{ transform:scaleY(1); } }

.fp-lyrics-body{
  padding: 20px 14px 60px; font-size:.86rem; line-height:1.85;
  white-space:pre-wrap; color: var(--bs-body-color);
}
.fp-lyrics-body.synced{ display:flex; flex-direction:column; gap:2px; padding: 22px 8px 80px; white-space: normal; }
.fp-lyric-line{
  padding: 9px 18px; border-radius:10px;
  font-size:.92rem; font-weight:500; line-height:1.5;
  color: rgba(var(--bs-body-color-rgb),.42);
  border-left: 3px solid transparent;
  transition: color .35s var(--mm-ease), background .35s var(--mm-ease),
              transform .35s var(--mm-ease), font-size .35s var(--mm-ease),
              font-weight .35s var(--mm-ease), border-color .35s var(--mm-ease);
  cursor:pointer; white-space: pre-wrap; transform-origin: left center;
  content-visibility: auto;
  contain-intrinsic-size: auto 2.6em;
}
.fp-lyric-line.passed{ color: rgba(var(--bs-body-color-rgb),.32); }
.fp-lyric-line.active{
  color: var(--bs-body-color); font-weight: 800; font-size: 1.08rem;
  background: linear-gradient(90deg, rgba(var(--bs-primary-rgb),.18), rgba(var(--bs-primary-rgb),.02) 72%, transparent);
  border-left-color: var(--bs-primary);
  padding-left: 15px;
  text-shadow: 0 0 22px rgba(var(--bs-primary-rgb),.4);
}
.fp-lyric-line.blank{ pointer-events:none; height:10px; padding:0; border:0; }
.fp-lyrics-empty{
  padding:60px 24px; text-align:center; color: var(--bs-secondary-color);
  font-size:.85rem; line-height:1.6;
}
.fp-lyrics-empty i{ display:block; font-size:2.6rem; opacity:.45; margin-bottom:12px; }

input[type=range].mm-range{
  -webkit-appearance:none; appearance:none;
  width:100%; height:20px; background:transparent; margin:0; display:block; cursor:pointer;
}
input[type=range].mm-range::-webkit-slider-runnable-track{
  height:4px; border-radius:999px;
  background: linear-gradient(to right,
    var(--bs-primary) var(--p,0%),
    rgba(var(--bs-body-color-rgb),.2) var(--p,0%));
}
input[type=range].mm-range::-webkit-slider-thumb{
  -webkit-appearance:none;
  width:13px; height:13px; border-radius:50%;
  background:#fff; margin-top:-4.5px;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
}
input[type=range].mm-range::-moz-range-track{ height:4px; border-radius:999px; background: rgba(var(--bs-body-color-rgb),.2); }
input[type=range].mm-range::-moz-range-progress{ height:4px; border-radius:999px; background: var(--bs-primary); }
input[type=range].mm-range::-moz-range-thumb{ width:13px; height:13px; border:0; border-radius:50%; background:#fff; }
input[type=range].mm-range.vol::-webkit-slider-runnable-track{
  background: linear-gradient(to right,
    var(--bs-secondary-color) var(--p,0%),
    rgba(var(--bs-body-color-rgb),.2) var(--p,0%));
}
input[type=range].mm-range.vol::-moz-range-progress{ background: var(--bs-secondary-color); }

.offcanvas.mm-sheet{
  height:auto; max-height:90vh;
  border-radius: 22px 22px 0 0; border:0;
  padding-bottom: var(--safe-bot);
  background: var(--bs-body-bg);
  z-index: 1090 !important;
}
.offcanvas-backdrop{ z-index: 1085 !important; }

.sheet-handle{
  width:38px; height:4px; border-radius:999px;
  background: rgba(var(--bs-body-color-rgb),.22);
  margin:10px auto 4px;
}
.sheet-title{
  font-size:.72rem; font-weight:800; letter-spacing:.08em;
  text-transform:uppercase; color:var(--bs-secondary-color);
  padding:8px 18px 6px;
}
.sheet-item{
  display:flex; align-items:center; gap:14px;
  width:100%; border:0; background:transparent;
  color: var(--bs-body-color); text-align:left;
  padding:13px 18px; font-size:.9rem; font-weight:600;
  border-radius:12px; transition: background .13s;
  cursor:pointer;
}
.sheet-item:active{ background: rgba(var(--bs-body-color-rgb),.08); }
.sheet-item > i:first-child{ font-size:1.18rem; width:24px; text-align:center; flex: 0 0 auto; color: var(--bs-secondary-color); }
.sheet-item.danger{ color: var(--bs-danger); }
.sheet-item.danger > i:first-child{ color: var(--bs-danger); }
.sheet-item .sub{ font-size:.72rem; color:var(--bs-secondary-color); font-weight:400; }

.settings-section{ padding: 8px 6px 4px; }
.settings-section-title{
  font-size:.66rem; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
  color: var(--bs-secondary-color); padding: 10px 14px 6px;
}
.settings-row{
  display:flex; align-items:center; gap:14px;
  padding: 12px 14px; border-radius: var(--mm-r-sm);
  transition: background .12s;
}
.settings-row > i:first-child{
  font-size:1.15rem; width:22px; text-align:center;
  color: var(--bs-secondary-color); flex: 0 0 auto;
}
.settings-row .sr-body{ flex:1; min-width:0; }
.settings-row .sr-title{ font-size:.88rem; font-weight:600; }
.settings-row .sr-sub{ font-size:.72rem; color: var(--bs-secondary-color); margin-top:2px; }
.settings-row .sr-control{ flex:0 0 auto; display:flex; align-items:center; gap:8px; }
.settings-row .sr-value{
  font-size:.8rem; color: var(--bs-secondary-color); font-weight:700;
  font-variant-numeric: tabular-nums; min-width:38px; text-align:right;
}
.mm-switch{ position:relative; display:inline-block; width:42px; height:24px; flex: 0 0 auto; cursor:pointer; }
.mm-switch input{ opacity:0; width:0; height:0; }
.mm-switch .slider{ position:absolute; inset:0; border-radius:99px; background: rgba(var(--bs-body-color-rgb),.18); transition: background .18s; }
.mm-switch .slider::before{ content:''; position:absolute; left:2px; top:2px; width:20px; height:20px; border-radius:50%; background:#fff; transition: transform .18s var(--mm-ease); box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.mm-switch input:checked + .slider{ background: var(--bs-primary); }
.mm-switch input:checked + .slider::before{ transform: translateX(18px); }

.seg-ctl{ display:inline-flex; border-radius: 8px; background: var(--mm-surface-2); padding: 3px; gap: 2px; }
.seg-ctl button{
  border:0; background:transparent; color: var(--bs-secondary-color);
  font-size:.76rem; font-weight:700; padding: 5px 10px; border-radius:6px;
  cursor:pointer; transition: all .12s;
}
.seg-ctl button.on{ background: var(--bs-body-bg); color: var(--bs-body-color); box-shadow: 0 1px 2px rgba(0,0,0,.1); }

.crawl-card{
  margin: 8px 16px 0;
  border-radius:14px; padding:12px 14px;
  display:flex; align-items:center; gap:12px;
  font-size:.82rem;
}
.crawl-card.pending{ background: rgba(var(--bs-info-rgb),.12); }
.crawl-card.ready  { background: rgba(var(--bs-success-rgb),.13); }
.crawl-card.fail   { background: rgba(var(--bs-danger-rgb),.12); }
.crawl-card.idle   { background: rgba(var(--bs-primary-rgb),.11); }
.crawl-card.preview{ background: rgba(var(--mm-preview-rgb),.11); }
.crawl-card .cc-body{ flex:1; min-width:0; }
.crawl-card .cc-title{ font-weight:700; font-size:.85rem; }
.crawl-card .cc-sub{ color: var(--bs-secondary-color); font-size:.72rem; margin-top:2px; }
.crawl-card .progress{ height:5px; border-radius:99px; background: rgba(var(--bs-body-color-rgb),.12); margin-top:8px; overflow:hidden; }
.crawl-card .progress-bar{ transition: width .4s ease; }

.hero{ text-align:center; padding: 4px 20px 0; }
.hero-art{
  width:200px; height:200px; max-width:58vw; max-height:58vw;
  border-radius:16px; object-fit:cover; margin:0 auto 16px; display:block;
  background: rgba(var(--bs-body-color-rgb),.07);
  box-shadow: 0 16px 44px rgba(0,0,0,.32);
}
.hero-art.round{ border-radius:50%; }
.hero-art-ph{ display:flex; align-items:center; justify-content:center; color: var(--bs-secondary-color); font-size:4rem; }
.hero-title{ font-size:1.22rem; font-weight:800; line-height:1.3; letter-spacing:-.02em; }
.hero-sub{ font-size:.82rem; color:var(--bs-secondary-color); margin-top:4px; }
.hero-sub a{ color:inherit; }
.hero-sub a:hover{ text-decoration: underline; }

.action-bar{
  display:flex; justify-content:center; align-items:center; gap:10px;
  padding: 16px 20px 12px; flex-wrap:wrap;
}
.action-bar.scrollable{
  flex-wrap:nowrap; overflow-x:auto; justify-content:center;
  scrollbar-width:none;
}
.action-bar .pill-btn:first-child{
    margin-left: 15px;
}
.action-bar.scrollable::-webkit-scrollbar{ display:none; }
.action-bar.scrollable > *{ flex:0 0 auto; }

.lyrics-card{
  margin: 20px 16px 0; border-radius: 16px;
  background: rgba(var(--bs-body-color-rgb),.045);
  overflow:hidden;
}
.lyrics-head{
  display:flex; align-items:center; gap:8px;
  padding:12px 16px; font-size:.78rem; font-weight:800;
  border-bottom: 1px solid var(--mm-divider);
}
.lyrics-head .lyrics-badge{
  font-size:.6rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
  padding:3px 7px; border-radius:5px;
  background: rgba(var(--bs-primary-rgb),.16); color: var(--bs-primary);
}
.lyrics-body{
  padding:14px 16px; font-size:.85rem; line-height:1.75;
  white-space:pre-wrap; color: var(--bs-body-color);
  max-height:340px; overflow-y:auto;
  scrollbar-width:none;
  position: relative;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  contain: layout style paint;
}
.lyrics-body::-webkit-scrollbar{ display:none; }
.lyrics-body.synced{ display:flex; flex-direction:column; gap:2px; padding: 16px 4px; white-space: normal; }
.lyric-line{
  padding: 8px 14px; border-radius:10px;
  font-size:.88rem; font-weight:500; line-height:1.5;
  color: rgba(var(--bs-body-color-rgb),.42);
  border-left: 3px solid transparent;
  transition: color .3s ease, background .3s ease, font-size .3s ease, font-weight .3s ease;
  cursor:pointer; white-space: pre-wrap;
  content-visibility: auto;
  contain-intrinsic-size: auto 2.4em;
}
.lyric-line.passed{ color: rgba(var(--bs-body-color-rgb),.32); }
.lyric-line.active{
  color: var(--bs-body-color); font-weight: 800; font-size: 1rem;
  padding-left: 11px;
}
.lyric-line.blank{ pointer-events:none; height:8px; padding:0; border:0; }

.install-step{ display:flex; gap:12px; align-items:flex-start; padding:10px 4px; }
.install-step .n{
  flex:0 0 auto; width:24px; height:24px; border-radius:50%;
  background: rgba(var(--bs-primary-rgb),.16); color: var(--bs-primary);
  display:flex; align-items:center; justify-content:center;
  font-size:.72rem; font-weight:800;
}
.install-step .t{ font-size:.84rem; line-height:1.45; }

.offline-banner{
  display:none; align-items:center; gap:8px;
  padding:6px 14px; font-size:.72rem; font-weight:700;
  background: rgba(var(--bs-warning-rgb),.16); color: var(--bs-warning);
  border-bottom: 1px solid rgba(var(--bs-warning-rgb),.22);
}
.offline-banner.on{ display:flex; }

.toast-container{ z-index:3000; }

@media (min-width: 720px){
  .app-main{ max-width:720px; margin:0 auto; width:100%; }
  .app-bottom{ max-width:720px; margin:0 auto; width:100%; }
  .app-bar{ max-width:720px; margin:0 auto; width:100%; }
  .fp-body{ padding:0 40px; }
  .fp-art{ max-width:380px; }
  .hero-art{ width:260px; height:260px; }
}
</style>
</head>
<body>

<header class="app-bar" id="appBar">
  <a class="brand" href="<?= $e($__scope) ?>" data-link>
    <i class="bi bi-soundwave"></i><span id="brandText">MusicMan</span>
  </a>
  <div class="page-title flex-grow-1 min-w-0 d-none" id="barTitle"></div>
  <div class="ms-auto d-flex align-items-center gap-1">
    <button class="icon-btn" id="installBtn" onclick="promptInstall()" aria-label="Install app" style="display:none">
      <i class="bi bi-box-arrow-down"></i>
    </button>
    <button class="icon-btn" id="dlIndicator" onclick="go('/library/downloads')" aria-label="Downloads" style="display:none;position:relative">
      <i class="bi bi-cloud-arrow-down"></i>
      <span class="tab-badge on" id="dlIndicatorCount" style="position:absolute;top:2px;right:2px;left:auto;margin:0">0</span>
    </button>
    <button class="icon-btn" onclick="openSettings()" aria-label="Settings"><i class="bi bi-gear"></i></button>
  </div>
</header>

<div id="offlineBanner" class="offline-banner">
  <i class="bi bi-wifi-off"></i>
  <span>You're offline — playing from saved tracks</span>
</div>

<main id="main" class="app-main scroll"></main>

<div class="app-bottom">
  <div id="mini" class="mini d-none">
    <div class="mini-progress"><div id="miniBar"></div></div>
    <div class="mini-row">
      <div class="d-flex align-items-center gap-2 flex-grow-1 min-w-0" onclick="openFullPlayer()">
        <img id="miniArt" class="mini-art" alt="">
        <div class="min-w-0 flex-grow-1">
          <div id="miniTitle" class="mini-title text-truncate">—</div>
          <div id="miniArtist" class="mini-sub text-truncate">—</div>
        </div>
      </div>
      <button class="icon-btn" onclick="event.stopPropagation();togglePlay()" aria-label="Play/pause">
        <i id="miniPlayIcon" class="bi bi-play-fill"></i>
      </button>
      <button class="icon-btn" onclick="event.stopPropagation();nextTrack()" aria-label="Next">
        <i class="bi bi-skip-forward-fill"></i>
      </button>
    </div>
  </div>
  <nav class="tabbar">
    <a data-nav="home"    href="<?= $e($__scope) ?>" data-link><i class="bi bi-house-door"></i><span>Home</span></a>
    <a data-nav="search"  href="<?= $e($__scope) ?>search" data-link><i class="bi bi-search"></i><span>Search</span></a>
    <a data-nav="library" href="<?= $e($__scope) ?>library/likes" data-link><i class="bi bi-collection"></i><span>Library</span>
      <span class="tab-badge" id="libBadge">0</span>
    </a>
  </nav>
</div>

<div id="full" class="full-player" aria-hidden="true">
  <div id="fpBg" class="fp-bg"></div>
  <div class="fp-scrim"></div>
  <div class="fp-inner">
    <div class="fp-head">
      <button class="icon-btn" onclick="closeFullPlayer()" aria-label="Close">
        <i class="bi bi-chevron-down" style="font-size:1.5rem"></i>
      </button>
      <div class="fp-head-tabs" id="fpHeadTabs">
        <button class="fp-head-tab active" data-fp-tab="now" onclick="setFpTab('now')">
          <i class="bi bi-play-circle"></i><span>Playing</span>
        </button>
        <button class="fp-head-tab" data-fp-tab="queue" onclick="setFpTab('queue')">
          <i class="bi bi-list-ul"></i><span>Queue</span>
          <span class="rs-badge" id="fpQueueBadge">0</span>
        </button>
        <button class="fp-head-tab" data-fp-tab="lyrics" onclick="setFpTab('lyrics')">
          <i class="bi bi-music-note-list"></i><span>Lyrics</span>
        </button>
      </div>
      <button class="icon-btn" onclick="fpMoreMenu()" aria-label="More">
        <i class="bi bi-three-dots"></i>
      </button>
    </div>

    <div class="fp-tabbody scroll" id="fpTabBody"></div>
  </div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetTrack">
  <div class="sheet-handle"></div>
  <div id="sheetTrackBody" class="pb-3"></div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetPl">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="sheetPlTitle">Add to playlist</div>
  <div id="sheetPlBody" class="pb-2" style="max-height:60vh;overflow-y:auto"></div>
  <div class="px-3 pt-1 pb-2">
    <button class="pill-btn primary w-100 justify-content-center" onclick="newPlaylistPrompt()">
      <i class="bi bi-plus-lg"></i> New playlist
    </button>
  </div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetPrompt">
  <div class="sheet-handle"></div>
  <div class="px-3 pt-2 pb-3">
    <div id="promptTitle" class="fw-bold mb-3">New playlist</div>
    <input id="promptInput" type="text" class="form-control form-control-lg mb-3" placeholder="Name" autocomplete="off" style="border-radius:12px">
    <div class="d-flex gap-2">
      <button class="pill-btn flex-fill justify-content-center" data-bs-dismiss="offcanvas">Cancel</button>
      <button class="pill-btn primary flex-fill justify-content-center" onclick="submitPrompt()">Save</button>
    </div>
  </div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetConfirm">
  <div class="sheet-handle"></div>
  <div class="px-3 pt-2 pb-3">
    <div id="cfTitle" class="fw-bold mb-2">Confirm</div>
    <div id="cfBody" class="text-secondary small mb-3"></div>
    <div class="d-flex gap-2">
      <button class="pill-btn flex-fill justify-content-center" data-bs-dismiss="offcanvas">Cancel</button>
      <button class="pill-btn flex-fill justify-content-center" id="cfOkBtn" style="background:var(--bs-danger);color:#fff">Delete</button>
    </div>
  </div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetQuality">
  <div class="sheet-handle"></div>
  <div class="sheet-title" id="sheetQualityTitle">Choose quality</div>
  <div id="sheetQualityBody" class="pb-3"></div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetSleep">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Sleep timer</div>
  <div class="px-2 pb-3">
    <button class="sheet-item" onclick="setSleepTimer(15)"><i class="bi bi-clock"></i><span>15 minutes</span></button>
    <button class="sheet-item" onclick="setSleepTimer(30)"><i class="bi bi-clock"></i><span>30 minutes</span></button>
    <button class="sheet-item" onclick="setSleepTimer(60)"><i class="bi bi-clock"></i><span>60 minutes</span></button>
    <button class="sheet-item" onclick="setSleepTimer(0)"><i class="bi bi-x-circle"></i><span>Cancel timer</span></button>
  </div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetSettings">
  <div class="sheet-handle"></div>
  <div class="d-flex align-items-center px-3 pt-1 pb-1">
    <div class="fw-bold flex-grow-1 ps-1" style="font-size:1.08rem">Settings</div>
    <button class="icon-btn sm" data-bs-dismiss="offcanvas"><i class="bi bi-x-lg"></i></button>
  </div>
  <div class="pb-3" style="overflow-y:auto;max-height:80vh">
    <div class="settings-section">
      <div class="settings-section-title">Appearance</div>
      <div class="settings-row">
        <i class="bi bi-circle-half"></i>
        <div class="sr-body"><div class="sr-title">Theme</div><div class="sr-sub">Choose your preferred look</div></div>
        <div class="sr-control seg-ctl" id="setTheme">
          <button data-val="dark">Dark</button>
          <button data-val="light">Light</button>
        </div>
      </div>
      <div class="settings-row">
        <i class="bi bi-stars"></i>
        <div class="sr-body"><div class="sr-title">Animations</div><div class="sr-sub">Smooth transitions and effects</div></div>
        <div class="sr-control">
          <label class="mm-switch"><input type="checkbox" id="setAnimations"><span class="slider"></span></label>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Playback</div>
      <div class="settings-row">
        <i class="bi bi-speedometer2"></i>
        <div class="sr-body"><div class="sr-title">Playback speed</div></div>
        <div class="sr-control">
          <input type="range" id="setRate" class="mm-range" min="50" max="200" step="5" style="width:110px">
          <span class="sr-value" id="setRateVal">1.00x</span>
        </div>
      </div>
      <div class="settings-row">
        <i class="bi bi-music-note-list"></i>
        <div class="sr-body"><div class="sr-title">Auto-scroll lyrics</div><div class="sr-sub">Follow active line automatically</div></div>
        <div class="sr-control">
          <label class="mm-switch"><input type="checkbox" id="setAutoScroll"><span class="slider"></span></label>
        </div>
      </div>
      <div class="settings-row">
        <i class="bi bi-recycle"></i>
        <div class="sr-body"><div class="sr-title">Auto-retry downloads</div><div class="sr-sub">Retry automatically on failure</div></div>
        <div class="sr-control">
          <label class="mm-switch"><input type="checkbox" id="setAutoRetry"><span class="slider"></span></label>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Storage</div>
      <div class="settings-row">
        <i class="bi bi-hdd"></i>
        <div class="sr-body"><div class="sr-title">Offline cache</div><div class="sr-sub" id="setCacheInfo">—</div></div>
        <div class="sr-control">
          <button class="pill-btn danger sm" onclick="clearAllCache()"><i class="bi bi-trash3"></i> Clear</button>
        </div>
      </div>
      <div class="settings-row">
        <i class="bi bi-clock-history"></i>
        <div class="sr-body"><div class="sr-title">Recent searches</div><div class="sr-sub" id="setRecentInfo">—</div></div>
        <div class="sr-control">
          <button class="pill-btn sm" onclick="clearRecent(); updateSettingsSheet()">Clear</button>
        </div>
      </div>
      <div class="settings-row">
        <i class="bi bi-arrow-counterclockwise"></i>
        <div class="sr-body"><div class="sr-title">Reset app data</div><div class="sr-sub">Remove all local settings, likes and playlists</div></div>
        <div class="sr-control">
          <button class="pill-btn danger sm" onclick="resetAppData()">Reset</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">About</div>
      <div class="settings-row">
        <i class="bi bi-info-circle"></i>
        <div class="sr-body"><div class="sr-title">MusicMan</div><div class="sr-sub">Version 3.7 · PWA</div></div>
        <div class="sr-control">
          <button class="pill-btn sm" onclick="checkForUpdate()"><i class="bi bi-arrow-repeat"></i> Update</button>
        </div>
      </div>
      <div class="settings-row">
        <i class="bi bi-keyboard"></i>
        <div class="sr-body"><div class="sr-title">Keyboard shortcuts</div><div class="sr-sub">Space · N · P · S · R · L · J · /</div></div>
      </div>
    </div>
  </div>
</div>

<div class="offcanvas offcanvas-bottom mm-sheet" tabindex="-1" id="sheetInstall">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Install MusicMan</div>
  <div class="px-3 pb-3" id="installBody"></div>
</div>

<div class="toast-container position-fixed bottom-0 start-50 translate-middle-x p-3" style="margin-bottom:calc(var(--safe-bot) + 84px)">
  <div id="toast" class="toast text-bg-dark border-0" role="alert" data-bs-delay="2400">
    <div class="d-flex align-items-center">
      <div class="toast-body" id="toastMsg"></div>
      <button class="btn-close btn-close-white me-2 ms-auto" data-bs-dismiss="toast"></button>
    </div>
  </div>
</div>

<script>
window.__MM_CONFIG__ = {
  basePath: <?= json_encode($MM['base_path'], JSON_UNESCAPED_SLASHES) ?>,
  apiBase:  <?= json_encode(rtrim($MM['api_base'], '/'), JSON_UNESCAPED_SLASHES) ?>,
  apiToken: <?= json_encode($MM['api_token'], JSON_UNESCAPED_SLASHES) ?>,
  siteName: <?= json_encode($MM['site_name'], JSON_UNESCAPED_SLASHES) ?>
};
window.__INITIAL_DATA__ = <?= $seoItem ? json_encode(mm_hydration_payload($seoItem), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) : 'null' ?>;
</script>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
'use strict';

const CFG = window.__MM_CONFIG__ || {};
const BASE = CFG.basePath || '';
const SCOPE = BASE + '/';
const API_BASE  = CFG.apiBase || 'https://3rah.ir/mm/api';
const API_TOKEN = CFG.apiToken || 'change_me_to_a_secure_token';

const IS_LOW_END = document.documentElement.classList.contains('low-end');

const KEY = {
  likes:    'mm_likes',
  pls:      'mm_playlists',
  recent:   'mm_recent',
  downloads:'mm_downloads',
  plays:    'mm_recently_played',
  following:'mm_followed',
  settings: 'mm_settings'
};
const SETTINGS_DEFAULT = {
  theme: 'dark',
  animations: true,
  playbackRate: 1,
  autoScrollLyrics: true,
  autoRetry: true,
};
const POLL_MS = IS_LOW_END ? 3500 : 2500;
const QUEUE_GRACE_MS = 3000;
const DEFAULT_CRAWL_QUALITY = '320';
const PROGRESS_TICK_MS = IS_LOW_END ? 300 : 100;
const LYRIC_TICK_MS = IS_LOW_END ? 250 : 150;

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const MAIN = () => document.getElementById('main');

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ls = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); } catch { return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  remove(k){ try{ localStorage.removeItem(k); } catch {} }
};

const cleanId  = id => id ? String(id).replace(/^it_/, '') : '';
const proxyUrl = u  => u ? `${API_BASE}/proxy?url=${encodeURIComponent(u)}` : '';
const haptic   = ms => { try { navigator.vibrate?.(ms); } catch {} };

function fmtTime(sec){
  sec = Number(sec);
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
           : `${m}:${String(s).padStart(2,'0')}`;
}
function fmtSize(b){
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
  return (b/1073741824).toFixed(2) + ' GB';
}
function safeFileName(s){
  const out = String(s || 'track')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return out || 'track';
}
function extFromType(type, url){
  const t = String(type || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3'))  return '.mp3';
  if (t.includes('mp4')  || t.includes('m4a'))  return '.m4a';
  if (t.includes('aac'))  return '.aac';
  if (t.includes('ogg') || t.includes('opus'))  return '.ogg';
  if (t.includes('webm')) return '.webm';
  if (t.includes('wav'))  return '.wav';
  if (t.includes('flac')) return '.flac';
  const m = String(url || '').split('?')[0].match(/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i);
  return m ? '.' + m[1].toLowerCase() : '.mp3';
}
function fmtAgo(ts){
  const d = Date.now() - (Number(ts) || 0);
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return Math.floor(d/60_000) + 'm ago';
  if (d < 86_400_000) return Math.floor(d/3_600_000) + 'h ago';
  if (d < 604_800_000) return Math.floor(d/86_400_000) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════════════════ */
function getSettings(){ return { ...SETTINGS_DEFAULT, ...ls.get(KEY.settings, {}) }; }
function setSetting(k, v){ const s = getSettings(); s[k] = v; ls.set(KEY.settings, s); applySettings(); }
function applySettings(){
  const s = getSettings();
  document.documentElement.setAttribute('data-bs-theme', s.theme);
  document.body.classList.toggle('no-animations', !s.animations);
  audio.playbackRate = Number(s.playbackRate) || 1;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = s.theme === 'dark' ? '#0b0b0d' : '#ffffff';
}

/* ══════════════════════════════════════════════════════════════
   TOAST / SHEETS
   ══════════════════════════════════════════════════════════════ */
let _toast;
function toast(msg, variant='dark'){
  const el = $('#toast'); if (!el) return;
  el.className = `toast text-bg-${variant} border-0`;
  $('#toastMsg').textContent = msg;
  _toast = _toast || new bootstrap.Toast(el);
  _toast.show();
}
function sheet(id){ return bootstrap.Offcanvas.getOrCreateInstance($(id)); }
function closeAllSheets(){
  ['#sheetTrack','#sheetPl','#sheetPrompt','#sheetConfirm','#sheetSleep','#sheetSettings','#sheetInstall','#sheetQuality']
    .forEach(s => {
      const el = $(s); if (!el) return;
      const i = bootstrap.Offcanvas.getInstance(el); if (i) i.hide();
    });
}
let _promptResolve = null;
function askText(title, value='', placeholder='Name'){
  return new Promise(resolve => {
    _promptResolve = resolve;
    $('#promptTitle').textContent = title;
    const inp = $('#promptInput');
    inp.value = value; inp.placeholder = placeholder;
    sheet('#sheetPrompt').show();
    setTimeout(() => inp.focus(), 350);
  });
}
function submitPrompt(){
  const v = $('#promptInput').value.trim();
  sheet('#sheetPrompt').hide();
  if (_promptResolve){ _promptResolve(v || null); _promptResolve = null; }
}
$('#sheetPrompt')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_promptResolve){ _promptResolve(null); _promptResolve = null; }
});
$('#promptInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitPrompt(); });

let _confirmResolve = null;
function askConfirm(title, body, okLabel='Delete', tone='danger'){
  return new Promise(resolve => {
    _confirmResolve = resolve;
    $('#cfTitle').textContent = title;
    $('#cfBody').textContent = body;
    const ok = $('#cfOkBtn');
    ok.textContent = okLabel;
    ok.style.background = tone === 'primary' ? 'var(--bs-primary)' : 'var(--bs-danger)';
    ok.style.color = '#fff';
    sheet('#sheetConfirm').show();
  });
}
$('#cfOkBtn')?.addEventListener('click', () => {
  sheet('#sheetConfirm').hide();
  if (_confirmResolve){ _confirmResolve(true); _confirmResolve = null; }
});
$('#sheetConfirm')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_confirmResolve){ _confirmResolve(false); _confirmResolve = null; }
});

let _qualityResolve = null;
function askQuality(options, title='Choose quality'){
  return new Promise(resolve => {
    _qualityResolve = resolve;
    $('#sheetQualityTitle').textContent = title;
    const body = $('#sheetQualityBody');
    body.innerHTML = options.map(o =>
      `<button class="sheet-item" onclick="pickQuality('${esc(o.value)}')">
        <i class="bi bi-music-note-beamed"></i>
        <span class="flex-grow-1">${esc(o.label)}</span>
        ${o.recommended ? '<span class="badge" style="background:var(--bs-primary)">Recommended</span>' : ''}
      </button>`
    ).join('');
    sheet('#sheetQuality').show();
  });
}
function pickQuality(v){
  sheet('#sheetQuality').hide();
  if (_qualityResolve){ _qualityResolve(v); _qualityResolve = null; }
}
$('#sheetQuality')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_qualityResolve){ _qualityResolve(null); _qualityResolve = null; }
});

/* ══════════════════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════════════════ */
async function api(path, opts={}){
  let res;
  try {
    res = await fetch(API_BASE + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_TOKEN,
        ...(opts.headers || {})
      }
    });
  } catch { throw new Error('Network error'); }
  const text = await res.text().catch(() => '');
  let data = {};
  if (text){ try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}
const apiSearch    = async term => (await api(`/search?term=${encodeURIComponent(term)}&limit=50&entity=musicArtist,album,song`)).results || [];
const apiFresh   = async ()   => (await api('/fresh')).results || [];
const apiPopular   = async (limit = 40) => (await api(`/popular?limit=${limit}&minViews=1`)).results || [];
const apiLookup    = async (id, entity) => (await api(`/lookup?id=${cleanId(id)}&entity=${entity}&limit=200`)).results || [];
const apiArtistTracks = async (id, { page = 1, limit = 50, sort = 'album' } = {}) =>
  api(`/artist/tracks?id=${encodeURIComponent(cleanId(id))}&page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}`);
const apiQueueAdd  = (body, quality) => api('/download/add', {
  method:'POST',
  body: JSON.stringify({ quality: quality || DEFAULT_CRAWL_QUALITY, skipExisting:true, ...body })
});

async function apiCrawlStatus(trackId){
  let r;
  try { r = await api(`/download/status?trackId=${cleanId(trackId)}`); }
  catch { return { download_status:'completed', percent:100, found:false }; }
  if (!r || !r.download){
    return { download_status:'completed', percent:100, found:false };
  }
  return { ...r.download, found:true };
}

/* ══════════════════════════════════════════════════════════════
   SEARCH SUGGEST
   ══════════════════════════════════════════════════════════════ */
const _sgCache = new Map();
const SG_CACHE_MAX = 60;

function _sgHighlight(name, q){
  if (!q) return esc(name);
  const lower  = String(name).toLowerCase();
  const needle = q.toLowerCase();
  const idx    = lower.indexOf(needle);
  if (idx < 0) return esc(name);
  return esc(name.slice(0, idx))
       + '<b>' + esc(name.slice(idx, idx + needle.length)) + '</b>'
       + esc(name.slice(idx + needle.length));
}

function initSuggest(input, dropdown){
  if (!input || !dropdown || input.__sgInit) return;
  input.__sgInit = true;

  let items = [];
  let activeIdx = -1;
  let lastQ = '';
  let debTimer = null;
  let ctrl = null;

  const close = () => {
    dropdown.classList.remove('show');
    dropdown.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    items = []; activeIdx = -1;
  };

  const render = () => {
    if (!items.length){ close(); return; }
    dropdown.innerHTML = items.map((it, i) => {
      const icon  = it.type === 'artist'     ? 'bi-person'
                  : it.type === 'collection' ? 'bi-disc'
                  :                            'bi-music-note';
      const label = it.type === 'artist'     ? 'Artist'
                  : it.type === 'collection' ? 'Album'
                  :                            'Song';
      return `<button type="button" role="option" class="sg-item${i === activeIdx ? ' active' : ''}" data-idx="${i}">
        <i class="bi ${icon} sg-icon"></i>
        <span class="sg-title flex-grow-1 min-w-0">${_sgHighlight(it.name, lastQ)}</span>
        <span class="sg-badge">${label}</span>
      </button>`;
    }).join('');
    dropdown.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
    if (activeIdx >= 0){
      const el = dropdown.querySelector('.sg-item.active');
      if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
  };

  const pick = (idx) => {
    const it = items[idx];
    if (!it) return;
    close();
    input.blur();
    const list = ls.get(KEY.recent, []).filter(x => x !== it.name);
    list.unshift(it.name);
    ls.set(KEY.recent, list.slice(0, 10));
    go(`/${it.type}/${it.id}`);
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q === lastQ) return;
    lastQ = q;
    if (debTimer) clearTimeout(debTimer);
    if (q.length < 1){ close(); return; }

    const cached = _sgCache.get(q.toLowerCase());
    if (cached){ items = cached; activeIdx = -1; render(); return; }

    if (!dropdown.classList.contains('show')){
      dropdown.innerHTML = `<div class="sg-loading"><span class="spinner-border spinner-border-sm" style="width:12px;height:12px;border-width:2px"></span> Searching…</div>`;
      dropdown.classList.add('show');
      input.setAttribute('aria-expanded', 'true');
    }

    debTimer = setTimeout(async () => {
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      try {
        const r = await fetch(
          `${API_BASE}/suggest?q=${encodeURIComponent(q)}&limit=8`,
          { headers: { 'Authorization': 'Bearer ' + API_TOKEN }, signal: ctrl.signal }
        );
        if (input.value.trim() !== q) return;
        const data = await r.json();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        if (_sgCache.size >= SG_CACHE_MAX){
          const first = _sgCache.keys().next().value;
          _sgCache.delete(first);
        }
        _sgCache.set(q.toLowerCase(), suggestions);
        items = suggestions;
        activeIdx = -1;
        if (!items.length){
          dropdown.innerHTML = `<div class="sg-empty"><i class="bi bi-search"></i> No matches</div>`;
          dropdown.classList.add('show');
          input.setAttribute('aria-expanded', 'true');
        } else render();
      } catch (e){
        if (e.name !== 'AbortError') close();
      }
    }, 160);
  });

  input.addEventListener('keydown', e => {
    if (!dropdown.classList.contains('show')) return;
    if (e.key === 'ArrowDown'){
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      render();
    } else if (e.key === 'ArrowUp'){
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, -1);
      render();
    } else if (e.key === 'Enter'){
      if (activeIdx >= 0 && items[activeIdx]){
        e.preventDefault();
        e.stopPropagation();
        pick(activeIdx);
      }
    } else if (e.key === 'Escape'){
      close();
      input.blur();
    }
  });

  dropdown.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.sg-item');
    if (btn) e.preventDefault();
  });
  dropdown.addEventListener('click', e => {
    const btn = e.target.closest('.sg-item');
    if (!btn) return;
    e.preventDefault();
    pick(Number(btn.dataset.idx));
  });

  input.addEventListener('blur', () => setTimeout(close, 140));
  input.addEventListener('focus', () => {
    if (items.length && input.value.trim() === lastQ) render();
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) close();
  });
}

/* ══════════════════════════════════════════════════════════════
   ITEM MODEL
   ══════════════════════════════════════════════════════════════ */
const TYPE_MAP = {
  musicArtist:'artist', artist:'artist',
  album:'collection', collection:'collection',
  song:'track', track:'track'
};
const itemType = it => TYPE_MAP[it?.wrapperType] || it?.wrapperType || '';
const itemId   = it => it?.trackId || it?.collectionId || it?.artistId || '';

function getArtwork(it, size=300){
  const urls = it?.attachments?.artworkUrls;
  if (Array.isArray(urls) && urls.length){
    const best = urls.find(u => String(u.size||'').includes(String(size))) || urls[urls.length-1];
    const url = best?.url || '';
    if (url) return url.replace(/\/(\d+)x(\d+)(bb)?\./, `/${size}x${size}bb.`);
  }
  const art = it?.artworkUrl || it?.artworkUrl100 || it?.artworkUrl60 || '';
  return art ? art.replace(/\/(\d+)x(\d+)(bb)?\./, `/${size}x${size}bb.`) : '';
}
window.getArtwork = getArtwork;
function hasAudio(it){
  const a = it?.attachments?.audioUrls;
  return Array.isArray(a) && a.some(x => x && x.url);
}
function hasPreview(it){
  const p = it?.attachments?.previewUrls;
  return Array.isArray(p) && p.some(x => x && x.url);
}
function getPreviewUrl(it){
  const p = it?.attachments?.previewUrls;
  if (!Array.isArray(p) || !p.length) return null;
  for (const x of p) if (x && x.url) return x.url;
  return null;
}
function getAudioOptions(it){
  const a = it?.attachments?.audioUrls;
  if (!Array.isArray(a)) return [];
  return a.filter(x => x && x.url && x.quality);
}
function pickAudioByQuality(it, preferQuality){
  const options = getAudioOptions(it);
  if (!options.length){
    const a = it?.attachments?.audioUrls;
    if (Array.isArray(a) && a.length && a[0]?.url) return a[0].url;
    return getPreviewUrl(it);
  }
  const target = parseInt(preferQuality, 10) || 192;
  const exact = options.find(o => String(o.quality) === String(preferQuality));
  if (exact) return exact.url;
  let closest = options[0], bestDiff = Infinity;
  for (const o of options){
    const q = parseInt(o.quality, 10);
    if (!isFinite(q)) continue;
    const diff = Math.abs(q - target);
    if (diff < bestDiff){ bestDiff = diff; closest = o; }
  }
  return closest?.url || null;
}
const getPlayable = it => pickAudioByQuality(it, DEFAULT_CRAWL_QUALITY);

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD / CRAWL ACTION MODEL
   ──────────────────────────────────────────────────────────────
   Tracks with direct audioUrls → "Download" (save instantly).
   Tracks without           → "Crawl"   (server-side queue).
   ══════════════════════════════════════════════════════════════ */
function dlActionFor(track){
  const isDirect = hasAudio(track);
  return {
    isDirect,
    label:      isDirect ? 'Download' : 'Crawl',
    icon:       isDirect ? 'bi-download' : 'bi-cloud-arrow-down',
    title:      isDirect ? 'Download' : 'Crawl',
    retryLabel: isDirect ? 'Retry download' : 'Retry crawl',
    idleTitle:  isDirect ? 'Not downloaded' : 'Not crawled',
    idleSub:    isDirect
      ? 'Full audio available — download for offline'
      : (hasPreview(track) ? 'Crawl to listen offline · preview available now'
                            : 'Crawl to listen offline'),
  };
}

const itemCache = new Map();
function cacheItems(items){
  for (const it of items || []){
    const t = itemType(it), id = itemId(it);
    if (t && id) itemCache.set(`${t}:${id}`, it);
  }
}
const getCached = (t, id) => itemCache.get(`${t}:${id}`);

/* ══════════════════════════════════════════════════════════════
   INDEXEDDB
   ══════════════════════════════════════════════════════════════ */
let _dbPromise;
function getDB(){
  if (!_dbPromise){
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('mm_audio', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath:'trackId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}
async function idb(store, mode, fn){
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
const cachePut   = (id, blob, meta) => idb('audio','readwrite', s => s.put({ trackId:String(id), blob, meta, size: blob.size, at: Date.now() }));
const cacheGet   = id => idb('audio','readonly', s => s.get(String(id))).then(r => r || null);
const cacheKeys  = () => idb('audio','readonly', s => (s.getAllKeys ? s.getAllKeys() : s.getAll())).then(r => r || []);
const cacheAll   = () => idb('audio','readonly', s => s.getAll()).then(r => r || []);
const cacheDel   = id => idb('audio','readwrite', s => s.delete(String(id)));
const cacheClear = () => idb('audio','readwrite', s => s.clear());

const cachedIds = new Set();
async function refreshCacheIndex(){
  cachedIds.clear();
  const keys = await cacheKeys();
  keys.forEach(k => {
    if (k && typeof k === 'object' && k.trackId) cachedIds.add(String(k.trackId));
    else if (k != null) cachedIds.add(String(k));
  });
}
const isCached = id => cachedIds.has(String(id));

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD MANAGER — unified download + crawl
   Status codes:
     queued    → waiting in server queue
     crawling  → server is fetching the audio
     saving    → client is fetching audio into IndexedDB (shown as "Downloading")
     ready     → server finished, awaiting client fetch
     completed → cached locally (transient)
     failed / paused
   ══════════════════════════════════════════════════════════════ */
const DL = {
  items: [], listeners: new Set(), timer: null, saving: new Set(),
  load(){
    const raw = ls.get(KEY.downloads, []);
    this.items = raw.map(it => it.status === 'saving'
      ? { ...it, status:'paused', percent:0, error:'Interrupted' }
      : it);
    this.persist();
  },
  persist(){ ls.set(KEY.downloads, this.items); },
  all(){    return this.items; },
  active(){ return this.items.filter(i => ['queued','crawling','saving'].includes(i.status)); },
  ready(){  return this.items.filter(i => i.status === 'ready'); },
  failed(){ return this.items.filter(i => ['failed','paused'].includes(i.status)); },
  get(id){  return this.items.find(i => String(i.trackId) === String(id)); },
  notify(){
    this.persist();
    updateDownloadBadges();
    this.listeners.forEach(fn => { try { fn(this); } catch(e){ console.warn(e); } });
  },
  onChange(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); },
  upsert(entry){
    const idx = this.items.findIndex(i => String(i.trackId) === String(entry.trackId));
    if (idx >= 0){
      this.items[idx] = { ...this.items[idx], ...entry, updatedAt: Date.now() };
    } else {
      this.items.unshift({
        trackId: String(entry.trackId),
        name: entry.name || 'Track',
        artist: entry.artist || '',
        artistId: entry.artistId || '',
        album: entry.album || '',
        collectionId: entry.collectionId || '',
        artwork: entry.artwork || '',
        type: 'save',
        status: entry.status || 'queued',
        percent: entry.percent || 0,
        error: entry.error || '',
        bytes: 0, totalBytes: 0,
        addedAt: entry.addedAt || Date.now(),
        updatedAt: Date.now()
      });
    }
    this.notify();
  },
  update(id, patch){
    const it = this.get(id); if (!it) return;
    Object.assign(it, patch, { updatedAt: Date.now() });
    this.notify();
  },
  remove(id){
    this.items = this.items.filter(i => String(i.trackId) !== String(id));
    this.notify();
  },
  async add(track, _type, quality){
    if (!track?.trackId) return;
    const id = String(track.trackId);
    if (isCached(id)){ toast('Already offline'); return; }
    const existing = this.get(id);
    if (existing && ['queued','crawling','saving'].includes(existing.status)){
      toast('Already in progress', 'warning'); return;
    }
    this.upsert({
      trackId: id,
      name: track.trackName || 'Track',
      artist: track.artistName || '',
      artistId: track.artistId ? String(track.artistId) : '',
      album: track.collectionName || '',
      collectionId: track.collectionId ? String(track.collectionId) : '',
      artwork: getArtwork(track, 100),
      status: 'queued', percent: 0, error: ''
    });
    haptic(12);
    // Direct-download path — save instantly, no server queue needed
    if (hasAudio(track)){
      this.update(id, { status:'saving', percent:0 });
      this._runSave(id, track).catch(e => this.update(id, { status:'failed', error: e.message }));
      return;
    }
    // Server crawl path
    try {
      await apiQueueAdd({ trackId: cleanId(id) }, quality);
    } catch (e){
      console.warn('[MusicMan] queue add error (ignored):', e.message);
    }
    this.update(id, { status:'queued', percent:0, addedAt: Date.now() });
    this._ensureTimer();
  },
  async retry(id){
    const it = this.get(id); if (!it) return;
    const track = getCached('track', id) || (await this._fetchTrack(id));
    if (!track){ toast('Track unavailable', 'danger'); return; }
    this.update(id, { status:'queued', error:'', percent:0, addedAt: Date.now() });
    if (hasAudio(track)){
      this.update(id, { status:'saving' });
      this._runSave(id, track).catch(e => this.update(id, { status:'failed', error: e.message }));
      return;
    }
    try {
      await apiQueueAdd({ trackId: cleanId(id) });
    } catch (e){
      console.warn('[MusicMan] queue retry error (ignored):', e.message);
    }
    this.update(id, { status:'queued' });
    this._ensureTimer();
  },
  async _fetchTrack(id){
    try {
      const r = await apiLookup(id, 'song');
      const it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
      return it;
    } catch { return null; }
  },
  async _runSave(id, track){
    if (this.saving.has(id)) return;
    this.saving.add(id);
    const url = getPlayable(track);
    if (!url){ this.saving.delete(id); throw new Error('No audio URL'); }
    try {
      const res = await fetch(proxyUrl(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const mime  = (res.headers.get('content-type') || '').split(';')[0] || 'audio/mpeg';
      const reader = res.body?.getReader?.();
      let blob;
      if (reader){
        const chunks = []; let received = 0; let lastReport = 0;
        while (true){
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); received += value.length;
          const pct = total ? Math.min(99, Math.round((received/total)*100)) : 0;
          const now = performance.now();
          if (now - lastReport > 250 || received === total){
            lastReport = now;
            this.update(id, { percent: pct, bytes: received, totalBytes: total });
          }
        }
        blob = new Blob(chunks);
      } else {
        blob = await res.blob();
      }
      await cachePut(id, blob, {
        name: track.trackName, artist: track.artistName, artistId: track.artistId,
        album: track.collectionName, collectionId: track.collectionId,
        artwork: getArtwork(track, 100), mime, url
      });
      cachedIds.add(String(id));
      this.update(id, {
        status: 'completed', percent: 100,
        bytes: blob.size, totalBytes: blob.size,
        completedAt: Date.now()
      });
      haptic(18);
      toast(`Downloaded · ${fmtSize(blob.size)}`);
      if (isLibraryDlRoute()) renderDownloads();
      if (isTrackRoute()) { const t = getCached('track', id); if (t) renderCrawlCard(t, null); }
      setTimeout(() => { if (this.get(id)?.status === 'completed') this.remove(id); }, 3500);
    } finally { this.saving.delete(id); }
  },
  async _markCompleted(id){
    const fresh = await this._fetchTrack(id);
    if (!fresh || !hasAudio(fresh)){
      this.update(id, { status: 'crawling', percent: 100 });
      return;
    }
    this.update(id, { status:'saving', percent:0 });
    this._runSave(id, fresh).catch(e => this.update(id, { status:'failed', error: e.message }));
  },
  _ensureTimer(){
    if (this.timer) return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const crawls = this.items.filter(i => ['queued','crawling'].includes(i.status));
        if (!crawls.length){ clearInterval(this.timer); this.timer = null; return; }
        for (const item of crawls){
          const id = String(item.trackId);
          const status = await apiCrawlStatus(id);
          const notFound = status.found === false;
          if (notFound && (Date.now() - (item.addedAt || 0)) < QUEUE_GRACE_MS) continue;
          const s   = status.download_status;
          const pct = Math.max(0, Math.min(100, Math.round(Number(status.percent) || 0)));
          if (notFound || s === 'completed'){
            await this._markCompleted(id);
          } else if (s === 'failed' || s === 'stopped'){
            if (getSettings().autoRetry && (item.retries || 0) < 3){
              setTimeout(() => DL.retry(id).catch(() => {}), 3000);
              this.update(id, { status:'failed', error:(status.error || 'Failed') + ' — retrying…', retries:(item.retries || 0) + 1 });
            } else {
              this.update(id, { status:'failed', error: status.error || 'Failed' });
            }
          } else {
            this.update(id, { status:'crawling', percent: pct });
          }
        }
      } finally { running = false; }
    };
    tick();
    this.timer = setInterval(tick, POLL_MS);
  }
};
function resumeDownloadPolling(){
  if (DL.items.some(i => ['queued','crawling'].includes(i.status))) DL._ensureTimer();
}
function updateDownloadBadges(){
  const total = DL.active().length + DL.ready().length;
  const ind = $('#dlIndicator'), indCount = $('#dlIndicatorCount');
  if (ind && indCount){ ind.style.display = total ? '' : 'none'; indCount.textContent = total; }
  const badge = $('#libBadge');
  if (badge){ badge.classList.toggle('on', total > 0); badge.textContent = total; }
}

/* ══════════════════════════════════════════════════════════════
   EXPORT OFFLINE AS FILE
   ══════════════════════════════════════════════════════════════ */
async function exportCached(id){
  let e; try { e = await cacheGet(id); } catch { e = null; }
  if (!e?.blob){ toast('File not available', 'danger'); return; }
  const m    = e.meta || {};
  const base = safeFileName([m.artist, m.name].filter(Boolean).join(' - ') || m.name || id);
  const mime = m.mime || 'audio/mpeg';
  const ext  = extFromType(mime, m.url || '');
  const blob = new Blob([e.blob], { type: mime });
  const url  = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url; a.download = base + ext; a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    haptic(14);
    toast(`Saved "${base + ext}"`);
  } catch {
    try { window.open(url, '_blank'); } catch {}
    toast('Opened file in a new tab');
  }
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 180000);
}
async function exportAllCached(){
  const all = await cacheAll();
  if (!all.length){ toast('Nothing to export', 'warning'); return; }
  const ok = await askConfirm(
    'Export all tracks?',
    `${all.length} file${all.length !== 1 ? 's' : ''} will be saved to your device.`,
    'Export', 'primary'
  );
  if (!ok) return;
  for (let i = 0; i < all.length; i++){
    await exportCached(all[i].trackId);
    await new Promise(r => setTimeout(r, 650));
  }
  toast('Export finished', 'success');
}

/* ══════════════════════════════════════════════════════════════
   LIKES / FOLLOWING / PLAYLISTS / RECENT
   ══════════════════════════════════════════════════════════════ */
const getLikes = () => ls.get(KEY.likes, []);
const isLiked  = id => getLikes().some(t => String(t.trackId) === String(id));
function makeLikeEntry(item){
  return {
    trackId: String(item.trackId),
    trackName: item.trackName || 'Unknown',
    artistName: item.artistName || '',
    artistId: item.artistId ? String(item.artistId) : '',
    collectionName: item.collectionName || '',
    collectionId: item.collectionId ? String(item.collectionId) : '',
    artworkUrl: getArtwork(item, 100) || item.artworkUrl || '',
    addedAt: Date.now()
  };
}
function toggleLike(item){
  if (!item?.trackId) return;
  const id = String(item.trackId);
  const likes = getLikes();
  const idx = likes.findIndex(t => String(t.trackId) === id);
  if (idx >= 0){ likes.splice(idx,1); toast('Removed from Liked'); }
  else { likes.unshift(makeLikeEntry(item)); toast('Added to Liked'); }
  ls.set(KEY.likes, likes);
  haptic(8);
  refreshLikes();
  if (isLibraryLikesRoute()) viewLikes();
}
async function toggleLikeById(id){
  let it = getCached('track', id);
  if (!it){
    try {
      const r = await apiLookup(id, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch {}
  }
  if (it) toggleLike(it); else toast('Track not available', 'danger');
}
function refreshLikes(){
  const cur = Player.track ? String(Player.track.trackId) : null;
  const nodes = MAIN().querySelectorAll('[data-like]');
  for (let i = 0; i < nodes.length; i++){
    const btn = nodes[i];
    const id = btn.dataset.like; if (!id) continue;
    const on = isLiked(id);
    if (on !== btn.classList.contains('liked')){
      btn.classList.toggle('liked', on);
      const ic = btn.firstElementChild;
      if (ic) ic.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
    }
  }
  const fpBtn = $('#fpLikeBtn');
  if (fpBtn){
    const on = cur ? isLiked(cur) : false;
    fpBtn.classList.toggle('liked', on);
    const i = $('#fpLike');
    if (i) i.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
  }
}

const getFollowed = () => ls.get(KEY.following, []);
const isFollowed  = id => !!id && getFollowed().some(a => String(a.artistId) === String(id));
function toggleFollow(artistId, artwork){
  const id = String(artistId);
  if (!id) return;
  const list = getFollowed();
  const idx = list.findIndex(a => String(a.artistId) === id);
  if (idx >= 0){ list.splice(idx, 1); toast('Unfollowed'); }
  else {
    const cached = getCached('artist', id);
    list.unshift({
      artistId: id,
      artistName: cached?.artistName || '',
      primaryGenreName: cached?.primaryGenreName || '',
      artwork: artwork || '',
      followedAt: Date.now()
    });
    toast('Following');
    haptic(10);
  }
  ls.set(KEY.following, list);
  refreshFollowButtons();
  if (isLibraryFollowingRoute()) viewFollowing();
}
function refreshFollowButtons(){
  $$('[data-follow]').forEach(btn => {
    const id = btn.dataset.follow;
    const on = isFollowed(id);
    btn.classList.toggle('following', on);
    btn.classList.toggle('primary', !on);
    const i = btn.querySelector('i');
    if (i) i.className = `bi ${on ? 'bi-check-lg' : 'bi-plus-lg'}`;
    const span = btn.querySelector('span');
    if (span) span.textContent = on ? 'Following' : 'Follow';
  });
}

const getPlaylists  = () => ls.get(KEY.pls, []);
const savePlaylists = p => ls.set(KEY.pls, p);
function createPlaylist(name){
  name = (name || '').trim(); if (!name) return null;
  const pl = {
    id:'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    name, tracks:[], createdAt: Date.now()
  };
  const all = getPlaylists(); all.push(pl); savePlaylists(all);
  toast(`Created "${name}"`);
  return pl;
}
function removeFromPlaylist(plId, trackId){
  const all = getPlaylists();
  const pl = all.find(p => p.id === plId); if (!pl) return;
  pl.tracks = pl.tracks.filter(t => String(t.trackId) !== String(trackId));
  savePlaylists(all);
  if (isPlaylistDetailRoute(plId)) renderPlaylistDetail(plId);
}

const getRecentlyPlayed = () => ls.get(KEY.plays, []);
function pushRecentlyPlayed(item){
  if (!item?.trackId) return;
  const id = String(item.trackId);
  const list = getRecentlyPlayed().filter(x => String(x.trackId) !== id);
  list.unshift({
    trackId: id,
    trackName: item.trackName || 'Track',
    artistName: item.artistName || '',
    artistId: item.artistId ? String(item.artistId) : '',
    collectionName: item.collectionName || '',
    collectionId: item.collectionId ? String(item.collectionId) : '',
    artworkUrl: getArtwork(item, 100) || item.artworkUrl || '',
    at: Date.now()
  });
  ls.set(KEY.plays, list.slice(0, 30));
}

/* ══════════════════════════════════════════════════════════════
   ROUTER
   ══════════════════════════════════════════════════════════════ */
function currentPath(){
  let p = location.pathname;
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (!p) p = '/';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '');
  return p || '/';
}
function parseRoute(){
  let path = currentPath().replace(/^\/+/, '');
  const parts = path ? path.split('/') : [];
  const q = new URLSearchParams(location.search || '');
  return { parts, q };
}
function go(path){
  if (!path) path = '/';
  if (!path.startsWith('/')) path = '/' + path;
  const target = (BASE || '') + path;
  const current = location.pathname + location.search;
  if (current === target){ route(); return; }
  try { history.pushState(null, '', target); } catch { location.href = target; return; }
  route();
}
window.addEventListener('popstate', () => route());
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  if (!href) return;
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
  if (href.startsWith('#')) return;
  let path = href;
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length);
  if (!path.startsWith('/')) return;
  e.preventDefault();
  go(path || '/');
});

const isLibraryLikesRoute      = () => currentPath() === '/library/likes';
const isLibraryFollowingRoute  = () => currentPath() === '/library/following';
const isLibraryDlRoute         = () => currentPath() === '/library/downloads';
const isLibraryPlRoute         = () => currentPath() === '/library/playlists';
const isPlaylistDetailRoute    = id => currentPath() === '/library/playlists/' + id;
const isTrackRoute             = () => currentPath().startsWith('/track/');
const isAlbumRoute             = () => currentPath().startsWith('/album/');
const isArtistRoute            = () => currentPath().startsWith('/artist/');

function activeNavFor(parts){
  const first = parts[0] || '';
  if (first === 'search') return 'search';
  if (first === 'library') return 'library';
  if (first === '') return 'home';
  return '';
}
const NAV_ICONS = {
  home:    { on:'bi-house-door-fill', off:'bi-house-door' },
  search:  { on:'bi-search',          off:'bi-search' },
  library: { on:'bi-collection-fill', off:'bi-collection' }
};
function updateNav(parts){
  const active = activeNavFor(parts);
  $$('[data-nav]').forEach(el => {
    const key = el.dataset.nav;
    const isOn = key === active;
    el.classList.toggle('active', isOn);
    const i = el.querySelector('i');
    if (i && NAV_ICONS[key]) i.className = `bi ${isOn ? NAV_ICONS[key].on : NAV_ICONS[key].off}`;
  });
  const brandText = $('#brandText');
  const barTitle = $('#barTitle');
  if (parts.length === 0){
    if (brandText) brandText.parentElement.style.display = '';
    if (barTitle) barTitle.classList.add('d-none');
    if (brandText) brandText.classList.remove('d-none');
  } else {
    if (brandText) brandText.classList.add('d-none');
    if (barTitle){
      barTitle.classList.remove('d-none');
      barTitle.textContent = titleForRoute(parts);
    }
  }
}
function titleForRoute(parts){
  if (parts[0] === 'search') return 'Search';
  if (parts[0] === 'library') return 'Library';
  if (parts[0] === 'artist') return 'Artist';
  if (parts[0] === 'album') return 'Album';
  if (parts[0] === 'track') return 'Track';
  return 'MusicMan';
}

async function route(){
  closeAllSheets();
    disconnectArtistTracksObserver();
  if (typeof dlUnsubscribe === 'function' && dlUnsubscribe){ dlUnsubscribe(); dlUnsubscribe = null; }

  const { parts, q } = parseRoute();
  updateNav(parts);
  closeFullPlayer();
  showSkeleton();

  try {
    switch (parts[0]){
      case undefined: await viewHome(); break;
      case 'search':  await viewSearch(q.get('q') || ''); break;
      case 'artist':  await viewArtist(parts[1]); break;
      case 'album':   await viewAlbum(parts[1]); break;
      case 'track':   await viewTrack(parts[1]); break;
      case 'library': {
        if (parts[1] === 'playlists'){
          if (parts[2]) renderPlaylistDetail(parts[2]);
          else viewPlaylists();
        } else if (parts[1] === 'downloads'){
          renderDownloads();
        } else if (parts[1] === 'following'){
          viewFollowing();
        } else {
          viewLikes();
        }
        break;
      }
      default: await viewHome();
    }
  } catch (e){
    console.error('[MusicMan route]', e);
    MAIN().innerHTML = errorState(e.message);
  }

  refreshLikes();
  refreshFollowButtons();
  MAIN().scrollTop = 0;
}

/* ══════════════════════════════════════════════════════════════
   SHARED UI HELPERS
   ══════════════════════════════════════════════════════════════ */
function showSkeleton(){
  const reps = IS_LOW_END ? 3 : 5;
  MAIN().innerHTML = `
    <div class="px-3 pt-4">
      <div class="sk mb-3" style="height:26px;width:45%"></div>
      <div class="d-flex gap-3 mb-4">
        ${'<div class="sk" style="width:138px;height:138px;border-radius:14px"></div>'.repeat(3)}
      </div>
      <div class="sk mb-3" style="height:18px;width:35%"></div>
      ${Array.from({length: reps}).map(() => `
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="sk" style="width:48px;height:48px;border-radius:10px"></div>
          <div class="flex-grow-1">
            <div class="sk mb-2" style="height:13px;width:65%"></div>
            <div class="sk" style="height:11px;width:40%"></div>
          </div>
        </div>`).join('')}
    </div>`;
}
function emptyState(icon, text, sub=''){
  return `<div class="state">
    <i class="bi bi-${icon}"></i>
    <p class="fw-semibold text-body">${esc(text)}</p>
    ${sub ? `<p class="mt-1" style="font-size:.78rem">${esc(sub)}</p>` : ''}
  </div>`;
}
function errorState(msg){
  return `<div class="state">
    <i class="bi bi-exclamation-triangle text-danger"></i>
    <p class="fw-semibold text-body">Something went wrong</p>
    <p class="mt-1" style="font-size:.78rem">${esc(msg || 'Unknown error')}</p>
    <button class="pill-btn mt-3" onclick="route()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
  </div>`;
}
function secTitle(text, tight=false){ return `<h6 class="sec-title ${tight ? 'tight' : ''}">${esc(text)}</h6>`; }
function backBtn(target){
  if (!target) target = BASE ? BASE + '/' : '/';
  return `<div class="px-2 pt-2">
    <a href="${esc(target)}" class="icon-btn" data-link aria-label="Back">
      <i class="bi bi-chevron-left" style="font-size:1.5rem"></i>
    </a>
  </div>`;
}

function cardAlbum(c){
  const art = getArtwork(c, 300);
  return `<a class="card-item" href="${SCOPE}album/${esc(c.collectionId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
          : `<div class="card-art card-art-ph"><i class="bi bi-disc"></i></div>`}
    <div class="card-name text-truncate">${esc(c.collectionName || 'Album')}</div>
    <div class="card-sub text-truncate">${esc(c.artistName || '')}</div>
  </a>`;
}
function cardTrack(t){
  const art = getArtwork(t, 300);
  return `<a class="card-item" href="${SCOPE}track/${esc(t.trackId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
          : `<div class="card-art card-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="card-name text-truncate">${esc(t.trackName || 'Track')}</div>
    <div class="card-sub text-truncate">${esc(t.artistName || '')}</div>
  </a>`;
}
function cardTrackPopular(t){
  const art = getArtwork(t, 300);
  const views = Number(t.views) || 0;
  const viewsLabel = views >= 1000 ? (views / 1000).toFixed(views >= 10000 ? 0 : 1) + 'K'
                    : String(views);
  const sub = [t.artistName, viewsLabel ? `` : ''].filter(Boolean).join(' · ');
  return `<a class="card-item" href="${SCOPE}track/${esc(t.trackId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
          : `<div class="card-art card-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="card-name text-truncate">${esc(t.trackName || 'Track')}</div>
    <div class="card-sub text-truncate">${esc(sub)}</div>
  </a>`;
}
function cardArtist(a){
  const art = getArtwork(a, 300);
  return `<a class="artist-item" href="${SCOPE}artist/${esc(a.artistId)}" data-link>
    ${art ? `<img class="artist-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
          : `<div class="artist-art artist-art-ph"><i class="bi bi-person-fill"></i></div>`}
    <div class="card-name text-truncate">${esc(a.artistName || 'Artist')}</div>
  </a>`;
}

/* Track row — play + info + like + more, badge-chip for status */
function trackRow(item, opts = {}){
  const id = String(item.trackId || '');
  const liked   = isLiked(id);
  const cached  = isCached(id);
  const dl      = DL.get(id);
  const art     = getArtwork(item, 100);
  const dur     = item.trackTimeMillis ? fmtTime(item.trackTimeMillis / 1000) : '';
  const sub     = [item.artistName, dur].filter(Boolean).join(' · ');
  const isCurrent = Player.track && String(Player.track.trackId) === id;
  const fullAudio = hasAudio(item);
  const previewOnly = !fullAudio && hasPreview(item) && !cached;

  let badge = '';
  if (cached) badge = `<span class="badge-chip crawled"><i class="bi bi-cloud-check-fill"></i>Offline</span>`;
  else if (dl && ['queued','crawling','saving'].includes(dl.status))
    badge = `<span class="badge-chip crawling"><span class="spinner-border"></span>${dl.status === 'saving' ? 'Downloading' : 'Crawling'}</span>`;
  else if (previewOnly)
    badge = `<span class="badge-chip preview"><i class="bi bi-play-circle"></i>Preview</span>`;

  const extraMenu = opts.playlistId ? `,'${esc(opts.playlistId)}'` : '';

  return `
  <div class="row-item ${isCurrent ? 'playing' : ''}" data-track-id="${esc(id)}">
    <button class="row-play ${isCurrent && Player.playing ? 'playing' : ''}"
            data-play-id="${esc(id)}"
            onclick="event.preventDefault();event.stopPropagation();playById('${esc(id)}')" aria-label="Play">
      <i class="bi ${isCurrent && Player.playing ? 'bi-pause-fill' : (previewOnly ? 'bi-play-circle' : 'bi-play-fill')}"></i>
    </button>
    <a class="row-info" href="${SCOPE}track/${esc(id)}" data-link>
      ${art ? `<img class="row-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
            : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
      <div class="min-w-0 flex-grow-1">
        <div class="row-title text-truncate">${esc(item.trackName || 'Track')}${badge ? ' ' + badge : ''}</div>
        <div class="row-sub text-truncate">${esc(sub)}</div>
      </div>
    </a>
    <button class="icon-btn sm ${liked ? 'liked' : ''}" data-like="${esc(id)}"
            onclick="event.preventDefault();event.stopPropagation();toggleLikeById('${esc(id)}')" aria-label="Like">
      <i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
    </button>
    <button class="icon-btn sm" onclick="event.preventDefault();event.stopPropagation();openTrackMenu('${esc(id)}'${extraMenu})" aria-label="More">
      <i class="bi bi-three-dots-vertical"></i>
    </button>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════════ */
async function viewHome(){
  // Fetch fresh + popular in parallel; a missing /popular endpoint must not break home.
  const [freshItems, popularItems] = await Promise.all([
    apiFresh().catch(() => []),
    apiPopular(40).catch(() => [])
  ]);
  cacheItems(freshItems);
  cacheItems(popularItems);

  const artists = freshItems.filter(i => itemType(i) === 'artist');
  const albums  = freshItems.filter(i => itemType(i) === 'collection');
  const tracks  = freshItems.filter(i => itemType(i) === 'track');

  // Only keep tracks that have real audio or a preview, dedupe by trackId
  const seen = new Set();
  const popular = popularItems
    .filter(i => itemType(i) === 'track')
    .filter(i => { const id = String(i.trackId || ''); if (!id || seen.has(id)) return false; seen.add(id); return true; });

  const recents = getRecentlyPlayed();

  const h = new Date().getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  let html = `<div class="pb-4">`;
  html += `<div class="px-3 pt-4 pb-1">
    <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">${greet}</div>
    <div class="text-secondary" style="font-size:.82rem">Welcome back to MusicMan</div>
  </div>`;

  if (recents.length){
    html += secTitle('Recently Played');
    html += `<div class="hscroll">${recents.slice(0, 10).map(r => cardTrack({
      wrapperType:'track', trackId: r.trackId, trackName: r.trackName,
      artistName: r.artistName,
      attachments: { artworkUrls: r.artworkUrl ? [{ url: r.artworkUrl }] : [] }
    })).join('')}</div>`;
  }

  if (popular.length){
    html += secTitle('Popular');
    html += `<div class="hscroll">${popular.slice(0, 20).map(cardTrackPopular).join('')}</div>`;
  }

  if (tracks.length){
    html += secTitle(recents.length ? 'Fresh Music' : 'Fresh');
    html += `<div class="hscroll">${tracks.map(cardTrack).join('')}</div>`;
  }

  if (artists.length){ html += secTitle('Fresh Artists'); html += `<div class="hscroll">${artists.map(cardArtist).join('')}</div>`; }
  if (albums.length) { html += secTitle('Fresh Albums');  html += `<div class="hscroll">${albums.map(cardAlbum).join('')}</div>`; }
  if (!freshItems.length && !popular.length && !recents.length) html += emptyState('collection', 'Nothing to show yet', 'Try searching for something.');

  html += `</div>`;
  MAIN().innerHTML = html;
}
/* ══════════════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════════════ */
let searchFilter = 'all';
let searchCache = { term: null, items: null };

function searchBarHtml(term=''){
  const voiceSupported = typeof FEAT !== 'undefined' && FEAT.Voice?.supported?.();
  return `<div class="search-wrap">
    <form onsubmit="event.preventDefault();submitSearch()">
      <div class="search-box">
        <i class="bi bi-search"></i>
        <input id="searchInput" type="search" placeholder="Songs, albums, artists…"
               value="${esc(term)}" autocomplete="off" enterkeyhint="search"
               role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="searchSuggest">
        ${term ? `<button type="button" class="icon-btn sm" onclick="clearSearch()" aria-label="Clear"><i class="bi bi-x-circle-fill"></i></button>` : ''}
        ${voiceSupported ? `<button type="button" class="icon-btn sm text-primary" onclick="FEAT.Voice.start()" aria-label="Voice search"><i class="bi bi-mic-fill"></i></button>` : ''}
      </div>
      <div class="search-suggest" id="searchSuggest" role="listbox" aria-label="Search suggestions"></div>
    </form>
    ${term ? `
      <div class="filter-row">
        <button class="chip ${searchFilter === 'all' ? 'on' : ''}"    data-filter="all"    onclick="setSearchFilter('all')">All</button>
        <button class="chip ${searchFilter === 'artist' ? 'on' : ''}" data-filter="artist" onclick="setSearchFilter('artist')">Artists</button>
        <button class="chip ${searchFilter === 'album' ? 'on' : ''}"  data-filter="album"  onclick="setSearchFilter('album')">Albums</button>
        <button class="chip ${searchFilter === 'track' ? 'on' : ''}"  data-filter="track"  onclick="setSearchFilter('track')">Songs</button>
      </div>` : ''}
  </div>`;
}
function wireSearchSuggest(autoFocus){
  requestAnimationFrame(() => {
    const inp = document.getElementById('searchInput');
    const dd  = document.getElementById('searchSuggest');
    if (inp && dd && typeof initSuggest === 'function') initSuggest(inp, dd);
    if (autoFocus && inp && document.activeElement === document.body) inp.focus();
  });
}
function setSearchFilter(f){
  searchFilter = f;
  if (searchCache.term && searchCache.items){
    renderSearchResults(searchCache.term, searchCache.items);
    refreshLikes();
  } else {
    const { q } = parseRoute();
    viewSearch(q.get('q') || '');
  }
}
function submitSearch(){
  const q = ($('#searchInput')?.value || '').trim();
  if (!q) return;
  const list = ls.get(KEY.recent, []).filter(x => x !== q);
  list.unshift(q); ls.set(KEY.recent, list.slice(0, 10));
  searchFilter = 'all';
  go('/search?q=' + encodeURIComponent(q));
}
function clearSearch(){ const i = $('#searchInput'); if (i){ i.value = ''; i.focus(); } }
function clearRecent(){ ls.remove(KEY.recent); viewSearch(''); }

async function viewSearch(term){
  if (!term){
    const recent = ls.get(KEY.recent, []);
    let html = `<div class="pb-4">${searchBarHtml('')}`;
    if (recent.length){
      html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
        <div class="sec-title p-0 flex-grow-1">Recent searches</div>
        <button class="icon-btn sm" onclick="clearRecent()" aria-label="Clear"><i class="bi bi-trash3"></i></button>
      </div>`;
      html += recent.map(r => `
        <button class="sheet-item" onclick="go('/search?q=${encodeURIComponent(r)}')">
          <i class="bi bi-clock-history"></i><span class="flex-grow-1">${esc(r)}</span>
        </button>`).join('');
    } else {
      html += emptyState('search', 'Find your music', 'Search for songs, albums and artists.');
    }
    html += `</div>`;
    MAIN().innerHTML = html;
    wireSearchSuggest(true);
    return;
  }

  let items;
  if (searchCache.term === term && searchCache.items){
    items = searchCache.items;
  } else {
    items = await apiSearch(term);
    searchCache = { term, items };
    cacheItems(items);
  }
  renderSearchResults(term, items);
}

function renderSearchResults(term, items){
  const artists = items.filter(i => itemType(i) === 'artist');
  const albums  = items.filter(i => itemType(i) === 'collection');
  const tracks  = items.filter(i => itemType(i) === 'track');

  const showTracks  = searchFilter === 'all' || searchFilter === 'track';
  const showAlbums  = searchFilter === 'all' || searchFilter === 'album';
  const showArtists = searchFilter === 'all' || searchFilter === 'artist';

  let html = `<div class="pb-4">${searchBarHtml(term)}`;

  if (!items.length){
    html += emptyState('emoji-frown', `No results for "${term}"`, 'Try different keywords.');
  } else {
    let hasSomething = false;

    if (showArtists && artists.length){
      hasSomething = true;
      html += secTitle(`Artists · ${artists.length}`);
      html += `<div class="hscroll">${artists.map(cardArtist).join('')}</div>`;
    }
    if (showAlbums && albums.length){
      hasSomething = true;
      html += secTitle(`Albums · ${albums.length}`);
      html += `<div class="hscroll">${albums.map(cardAlbum).join('')}</div>`;
    }
    if (showTracks && tracks.length){
      hasSomething = true;
      html += secTitle(`Songs · ${tracks.length}`);
      html += tracks.map(t => trackRow(t)).join('');
    }
    if (!hasSomething){
      html += emptyState('funnel', 'No matches for this filter');
    }
  }

  html += `</div>`;
  MAIN().innerHTML = html;
  wireSearchSuggest(false);
}

/* ─── Artist tracks: pagination + infinite scroll ─── */
const _artistTracks = {
  artistId: null,
  sort: 'album',
  page: 0,
  limit: 50,
  total: 0,
  pages: 0,
  hasMore: false,
  loading: false,
  items: [],
};
let _artistTracksObserver = null;

function disconnectArtistTracksObserver(){
  if (_artistTracksObserver){ _artistTracksObserver.disconnect(); _artistTracksObserver = null; }
}

async function loadArtistTracks(artistId, { reset = false, sort = null } = {}){
  if (!artistId) return;
  const st = _artistTracks;

  if (reset || st.artistId !== String(artistId)){
    st.artistId = String(artistId);
    st.page = 0;
    st.items = [];
    st.total = 0;
    st.pages = 0;
    st.hasMore = false;
  }
  if (sort) st.sort = sort;
  if (st.loading || (st.page > 0 && !st.hasMore)) return;

  st.loading = true;
  const nextPage = st.page + 1;
  const sentinel = document.getElementById('artistTracksSentinel');
  const listEl   = document.getElementById('artistTracksList');

  if (sentinel){
    sentinel.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;
  }

  try {
    const res = await apiArtistTracks(artistId, { page: nextPage, limit: st.limit, sort: st.sort });
    const tracks = (res.results || []).filter(t => itemType(t) === 'track');
    st.page    = nextPage;
    st.total   = res.total ?? tracks.length;
    st.pages   = res.pages ?? 1;
    st.hasMore = !!res.hasMore;
    st.items   = st.items.concat(tracks);
    cacheItems(tracks);

    _pageTracks = st.items;

    if (listEl && tracks.length){
      const html = tracks.map(t => trackRow(t)).join('');
      listEl.insertAdjacentHTML('beforeend', html);
    }

    const countEl = document.getElementById('artistTrackCount');
    if (countEl) countEl.textContent = `${st.items.length} of ${st.total}`;

    // Update Play-all / bulk-action buttons
    const playAllBtn = document.getElementById('artistPlayAllBtn');
    if (playAllBtn) playAllBtn.disabled = st.items.length === 0;
    const likeAllBtn = document.getElementById('artistLikeAllBtn');
    if (likeAllBtn){
      const allLiked = st.items.length > 0 && st.items.every(t => isLiked(t.trackId));
      likeAllBtn.classList.toggle('liked', allLiked);
      const i = likeAllBtn.querySelector('i');
      if (i) i.className = `bi ${allLiked ? 'bi-heart-fill' : 'bi-heart'}`;
    }

    refreshLikes();
  } catch (e){
    console.warn('[MusicMan] artist tracks error:', e);
    if (sentinel){
      sentinel.innerHTML = `<div class="text-center py-4">
        <button class="pill-btn" onclick="loadArtistTracks('${esc(artistId)}')">
          <i class="bi bi-arrow-repeat"></i> Retry
        </button>
      </div>`;
    }
  } finally {
    st.loading = false;
    if (sentinel && st.hasMore){
      sentinel.innerHTML = `<div class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-secondary" style="opacity:.4"></div>
      </div>`;
    } else if (sentinel && !st.hasMore){
      sentinel.innerHTML = st.items.length
        ? `<div class="text-center py-4 text-secondary" style="font-size:.75rem">All ${st.total} track${st.total !== 1 ? 's' : ''} loaded</div>`
        : '';
    }
  }

  // Fill viewport if there's still room to scroll
  requestAnimationFrame(() => {
    if (!st.hasMore || st.loading) return;
    const s = document.getElementById('artistTracksSentinel');
    const m = document.getElementById('main');
    if (!s || !m) return;
    const rect = s.getBoundingClientRect();
    const rootRect = m.getBoundingClientRect();
    if (rect.top < rootRect.bottom + 300) loadArtistTracks(artistId);
  });
}

function attachArtistTracksObserver(){
  disconnectArtistTracksObserver();
  const root = document.getElementById('main');
  const sentinel = document.getElementById('artistTracksSentinel');
  if (!root || !sentinel) return;

  _artistTracksObserver = new IntersectionObserver(entries => {
    for (const e of entries){
      if (!e.isIntersecting) continue;
      if (_artistTracks.loading || !_artistTracks.hasMore) continue;
      loadArtistTracks(_artistTracks.artistId);
    }
  }, { root, rootMargin: '500px 0px', threshold: 0.01 });

  _artistTracksObserver.observe(sentinel);
}

function setArtistSort(sort){
  if (_artistTracks.sort === sort) return;
  const listEl = document.getElementById('artistTracksList');
  if (listEl) listEl.innerHTML = '';
  _artistTracks.items = [];
  _artistTracks.page = 0;
  _artistTracks.hasMore = true;
  _artistTracks.sort = sort;
  $$('#artistSort .chip').forEach(b => b.classList.toggle('on', b.dataset.sort === sort));
  loadArtistTracks(_artistTracks.artistId, { reset: true, sort });
}
/* ══════════════════════════════════════════════════════════════
   ARTIST
   ══════════════════════════════════════════════════════════════ */
async function viewArtist(id){
  if (!id){ MAIN().innerHTML = emptyState('person', 'Artist not found'); return; }

  // Reset pagination state for this artist
  _artistTracks.artistId = String(id);
  _artistTracks.sort = 'album';
  _artistTracks.page = 0;
  _artistTracks.items = [];
  _artistTracks.hasMore = true;
  _artistTracks.loading = false;

  let artist = getCached('artist', id);
  if (!artist){
    const r = await apiLookup(id, 'musicArtist');
    artist = r.find(x => itemType(x) === 'artist') || r[0];
    if (artist) cacheItems([artist]);
  }
  if (!artist){ MAIN().innerHTML = emptyState('person', 'Artist not found'); return; }

  // Albums — one lookup; tracks come from /artist/tracks
  const albumRes = await apiLookup(id, 'album').catch(() => []);
  const albumMap = new Map();
  for (const a of albumRes.filter(x => itemType(x) === 'collection')){
    const cid = String(a.collectionId || '');
    if (cid && !albumMap.has(cid)) albumMap.set(cid, a);
  }
  const albums = Array.from(albumMap.values());
  cacheItems(albums);
  const fullAlbums = albums.filter(a => (a.trackCount || 0) > 1);

  let artistArt = '';
  for (const a of albums){ const ar = getArtwork(a, 400); if (ar){ artistArt = ar; break; } }

  const followed = isFollowed(id);
  const genre = artist.primaryGenreName || '';

  const subParts = [];
  if (genre) subParts.push(esc(genre));
  if (albums.length) subParts.push(`${albums.length} album${albums.length !== 1 ? 's' : ''}`);
  subParts.push(`<span id="artistTrackCount">0 of —</span>`);

  let html = `<div class="pb-4">`;
  html += backBtn(SCOPE);
  html += `<div class="hero">
    ${artistArt
      ? `<img class="hero-art round" src="${esc(artistArt)}" loading="lazy" decoding="async" alt="">`
      : `<div class="hero-art hero-art-ph round"><i class="bi bi-person-fill"></i></div>`}
    <div class="hero-title">${esc(artist.artistName || 'Artist')}</div>
    <div class="hero-sub">${subParts.join(' · ')}</div>
  </div>`;

  html += `<div class="action-bar scrollable">
    <button class="pill-btn success" id="artistPlayAllBtn" disabled
            onclick="playIds(_pageTracks.map(t => t.trackId).join(','))">
      <i class="bi bi-play-fill"></i> Play all
    </button>
    <button class="pill-btn ${followed ? '' : 'primary'}" data-follow="${esc(id)}"
            onclick="toggleFollow('${esc(id)}', '${esc(artistArt)}')">
      <i class="bi ${followed ? 'bi-check-lg' : 'bi-plus-lg'}"></i>
      <span>${followed ? 'Following' : 'Follow'}</span>
    </button>
    <button class="pill-btn" onclick="crawlAll('artist','${esc(id)}',this)">
      <i class="bi bi-cloud-arrow-down"></i> Crawl artist
    </button>
    <button class="icon-btn" style="background:rgba(var(--bs-body-color-rgb),.09)"
            onclick="artistMore('${esc(id)}')" aria-label="More">
      <i class="bi bi-three-dots"></i>
    </button>
  </div>`;

  if (fullAlbums.length){
    html += secTitle(`Albums · ${fullAlbums.length}`);
    html += `<div class="hscroll">${fullAlbums.map(cardAlbum).join('')}</div>`;
  }

  html += `<div class="d-flex align-items-center gap-2 px-3" style="margin-top:8px">
    <div class="sec-title p-0 flex-grow-1" style="padding-top:0">Tracks</div>
  </div>
  <div class="filter-row" id="artistSort" style="padding-top:2px">
    <button class="chip on" data-sort="album"  onclick="setArtistSort('album')">Album</button>
    <button class="chip"    data-sort="recent" onclick="setArtistSort('recent')">Recent</button>
    <button class="chip"    data-sort="name"   onclick="setArtistSort('name')">A–Z</button>
    <button class="chip"    data-sort="views"  onclick="setArtistSort('views')">Popular</button>
  </div>`;

  html += `<div id="artistTracksList"></div>`;
  html += `<div id="artistTracksSentinel"></div>`;

  html += `</div>`;
  MAIN().innerHTML = html;

  // Kick off first page, then attach the infinite-scroll observer
  await loadArtistTracks(id, { reset: true, sort: 'album' });
  attachArtistTracksObserver();
}
function artistMore(id){
  const rows = [
    `<button class="sheet-item" onclick="closeAllSheets(); addAllToQueue(_pageTracks)"><i class="bi bi-list-ul"></i><span>Queue all tracks</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); openPlaylistPickerForItems(_pageTracks)"><i class="bi bi-plus-lg"></i><span>Add all to playlist</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); toggleLikeAll(_pageTracks)"><i class="bi bi-heart"></i><span>Like / unlike all</span></button>`,
  ];
  $('#sheetTrackBody').innerHTML = `
    <div class="px-3 pb-2 pt-1"><div class="fw-bold">Artist actions</div></div>
    <div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}

/* ══════════════════════════════════════════════════════════════
   ALBUM
   ══════════════════════════════════════════════════════════════ */
async function viewAlbum(id){
  if (!id){ MAIN().innerHTML = emptyState('disc', 'Album not found'); return; }

  let album = getCached('collection', id);
  if (!album){
    const r = await apiLookup(id, 'album');
    album = r.find(x => itemType(x) === 'collection') || r[0];
    if (album) cacheItems([album]);
  }
  if (!album){ MAIN().innerHTML = emptyState('disc', 'Album not found'); return; }

  const tracks = (await apiLookup(id, 'song')).filter(x => itemType(x) === 'track');
  cacheItems(tracks);

  const art     = getArtwork(album, 600);
  const missing = tracks.filter(t => !hasAudio(t) && !isCached(t.trackId)).length;
  const ids     = tracks.map(t => String(t.trackId)).join(',');
  const year    = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';

  _pageTracks = tracks.map(t => ({
    wrapperType:'track',
    trackId: t.trackId, trackName: t.trackName,
    artistName: t.artistName, artistId: t.artistId,
    collectionName: t.collectionName, collectionId: t.collectionId,
    trackTimeMillis: t.trackTimeMillis,
    attachments: {
      artworkUrls: t.attachments?.artworkUrls || [],
      previewUrls: t.attachments?.previewUrls || [],
      audioUrls: t.attachments?.audioUrls || []
    }
  }));

  let html = `<div class="pb-4">`;
  html += backBtn(album.artistId ? `${SCOPE}artist/${album.artistId}` : SCOPE);
  html += `<div class="hero">
    ${art ? `<img class="hero-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
          : `<div class="hero-art hero-art-ph"><i class="bi bi-disc"></i></div>`}
    <div class="hero-title">${esc(album.collectionName || 'Album')}</div>
    <div class="hero-sub">
      ${album.artistId ? `<a href="${SCOPE}artist/${esc(album.artistId)}" data-link>${esc(album.artistName || '')}</a>` : esc(album.artistName || '')}
      ${year ? ` · ${year}` : ''}
      ${album.trackCount ? ` · ${album.trackCount} tracks` : ''}
    </div>
  </div>`;

  html += `<div class="action-bar scrollable">
    ${tracks.length ? `<button class="pill-btn success" onclick="playIds('${esc(ids)}')">
      <i class="bi bi-play-fill"></i> Play
    </button>` : ''}
    ${tracks.length && missing > 0 ? `<button class="pill-btn primary" onclick="crawlAll('collection','${esc(id)}',this)">
      <i class="bi bi-cloud-arrow-down"></i> Crawl all (${missing})
    </button>` : ''}
    ${tracks.length && missing === 0 ? `<span class="pill-btn" style="background:rgba(var(--bs-success-rgb),.16);color:var(--bs-success)">
      <i class="bi bi-check-circle-fill"></i> All ready
    </span>` : ''}
    ${tracks.length ? `<button class="icon-btn" style="background:rgba(var(--bs-body-color-rgb),.09)"
      onclick="albumMore()" aria-label="More">
      <i class="bi bi-three-dots"></i>
    </button>` : ''}
  </div>`;

  html += tracks.length ? tracks.map(t => trackRow(t)).join('') : emptyState('music-note', 'No tracks found');
  html += `</div>`;
  MAIN().innerHTML = html;
}

function albumMore(){
  const rows = [
    `<button class="sheet-item" onclick="closeAllSheets(); addAllToQueue(_pageTracks)"><i class="bi bi-list-ul"></i><span>Queue all tracks</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); openPlaylistPickerForItems(_pageTracks)"><i class="bi bi-plus-lg"></i><span>Add all to playlist</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); toggleLikeAll(_pageTracks)"><i class="bi bi-heart"></i><span>Like / unlike all</span></button>`,
  ];
  $('#sheetTrackBody').innerHTML = `
    <div class="px-3 pb-2 pt-1"><div class="fw-bold">Album actions</div></div>
    <div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}

/* ══════════════════════════════════════════════════════════════
   TRACK PAGE
   ══════════════════════════════════════════════════════════════ */
let trackPoller = null;
function stopTrackPoller(){ if (trackPoller){ clearInterval(trackPoller); trackPoller = null; } }
let lyricsTrackId = null;

async function viewTrack(id){
  if (!id){ MAIN().innerHTML = emptyState('music-note', 'Track not found'); return; }
  stopTrackPoller();
  lyricsTrackId = String(id);

  let track = null;
  try {
    const r = await apiLookup(id, 'song');
    track = r.find(x => itemType(x) === 'track') || r[0];
    if (track) cacheItems([track]);
  } catch {}
  if (!track) track = getCached('track', id);
  if (!track){ MAIN().innerHTML = emptyState('music-note', 'Track not found'); return; }

  renderTrackPage(track);

  const dl = DL.get(id);
  const crawling = dl && ['queued','crawling'].includes(dl.status);

  if (crawling || (!hasAudio(track) && !isCached(id))){
    const status = await apiCrawlStatus(id);
    renderCrawlCard(track, status);
    if (crawling || (status && ['pending','downloading'].includes(status.download_status))) {
      startTrackPoller(id);
    }
  } else {
    renderCrawlCard(track, null);
  }
}

function renderTrackPage(track){
  const id = String(track.trackId);
  const art = getArtwork(track, 600);
  const liked   = isLiked(id);
  const cached  = isCached(id);
  const crawled = hasAudio(track);
  const previewable = !crawled && hasPreview(track) && !cached;
  const playable = crawled || cached;
  const dur  = track.trackTimeMillis ? fmtTime(track.trackTimeMillis/1000) : '';
  const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '';
  const dl   = DL.get(id);
  const action = dlActionFor(track);

  let html = `<div class="pb-4">`;
  html += backBtn(track.artistId ? `${SCOPE}artist/${track.artistId}` : SCOPE);
  html += `<div class="hero">
    ${art ? `<img class="hero-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
          : `<div class="hero-art hero-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="hero-title">${esc(track.trackName || 'Track')}</div>
    <div class="hero-sub">
      ${track.artistId ? `<a href="${SCOPE}artist/${esc(track.artistId)}" data-link>${esc(track.artistName || '')}</a>` : esc(track.artistName || '')}
      ${track.collectionId ? ` · <a href="${SCOPE}album/${esc(track.collectionId)}" data-link>${esc(track.collectionName || '')}</a>` : ''}
    </div>
    <div class="hero-sub" style="font-size:.74rem">
      ${[year, dur, track.primaryGenreName].filter(Boolean).join(' · ')}
    </div>
  </div>`;

  let primaryBtn = '';
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    const label = dl.status === 'queued'
      ? 'Queued'
      : dl.status === 'crawling' ? 'Crawling' : 'Downloading';
    primaryBtn = `<button class="pill-btn info" onclick="go('/library/downloads')">
      <span class="spinner-border spinner-border-sm me-1" style="width:14px;height:14px;border-width:2px"></span>
      ${label}${dl.percent ? ' · ' + dl.percent + '%' : ''}
    </button>`;
  } else if (!playable){
    if (previewable){
      primaryBtn = `<button class="pill-btn preview" onclick="playById('${esc(id)}')">
        <i class="bi bi-play-circle"></i> Play preview
      </button>`;
    } else {
      primaryBtn = `<button class="pill-btn primary" onclick="startCrawl('${esc(id)}', this)">
        <i class="bi ${action.icon}"></i> ${action.label}
      </button>`;
    }
  } else {
    primaryBtn = `<button class="pill-btn success" onclick="playById('${esc(id)}')">
      <i class="bi bi-play-fill"></i> ${cached ? 'Play offline' : 'Play'}
    </button>`;
  }

  html += `<div class="action-bar">
    ${primaryBtn}
    <button class="icon-btn ${liked ? 'liked' : ''}" data-like="${esc(id)}"
            onclick="toggleLikeById('${esc(id)}')" aria-label="Like"
            style="background:rgba(var(--bs-body-color-rgb),.09)">
      <i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
    </button>
    <button class="icon-btn" onclick="openTrackMenu('${esc(id)}')" aria-label="More"
            style="background:rgba(var(--bs-body-color-rgb),.09)">
      <i class="bi bi-three-dots"></i>
    </button>
  </div>`;

  html += `<div id="crawlCard"></div>`;

  html += `<div class="lyrics-card">
    <div class="lyrics-head">
      <i class="bi bi-music-note-list"></i>
      <span class="flex-grow-1">Lyrics</span>
      <span class="lyrics-badge" id="lyricsBadge" style="display:none">Synced</span>
      <button class="icon-btn sm" onclick="copyLyrics()" aria-label="Copy lyrics"><i class="bi bi-clipboard"></i></button>
    </div>
    <div class="lyrics-body" id="lyricsBody">
      <div class="text-secondary d-flex align-items-center gap-2" style="font-size:.82rem">
        <span class="spinner-border spinner-border-sm"></span> Loading lyrics…
      </div>
    </div>
  </div>`;

  html += `</div>`;
  MAIN().innerHTML = html;
  loadLyrics(id, track);
}

function renderCrawlCard(track, status){
  const el = $('#crawlCard'); if (!el) return;
  const id = String(track.trackId);
  const cached  = isCached(id);
  const dl      = DL.get(id);
  const action  = dlActionFor(track);
  const previewable = !hasAudio(track) && hasPreview(track) && !cached;

  if (cached){
    el.innerHTML = `<div class="crawl-card ready">
      <i class="bi bi-cloud-check-fill text-success" style="font-size:1.5rem"></i>
      <div class="cc-body">
        <div class="cc-title">Saved offline</div>
        <div class="cc-sub">Ready to play without internet</div>
      </div>
      <button class="pill-btn primary sm" onclick="exportCached('${esc(id)}')">
        <i class="bi bi-file-earmark-arrow-down"></i> Save file
      </button>
      <button class="icon-btn sm text-danger" onclick="removeCached('${esc(id)}')" aria-label="Remove">
        <i class="bi bi-trash3"></i>
      </button>
    </div>`;
    return;
  }
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    const isSaving = dl.status === 'saving';
    const label = dl.status === 'queued'
      ? (action.isDirect ? 'Queued to download' : 'Queued to crawl')
      : isSaving ? 'Downloading'
                 : 'Crawling';
    const pct = dl.percent || 0;
    el.innerHTML = `<div class="crawl-card pending" style="flex-direction:column;align-items:stretch">
      <div class="d-flex align-items-center gap-2">
        <span class="spinner-border spinner-border-sm text-info"></span>
        <span class="cc-title flex-grow-1">${label}…</span>
        <span class="fw-bold text-info" style="font-size:.8rem">${pct}%</span>
      </div>
      <div class="progress mt-2"><div class="progress-bar bg-info" style="width:${pct}%"></div></div>
      ${isSaving && dl.totalBytes ? `<div class="cc-sub">${fmtSize(dl.bytes)} / ${fmtSize(dl.totalBytes)}</div>` : ''}
    </div>`;
    return;
  }
  if (dl && dl.status === 'failed'){
    el.innerHTML = `<div class="crawl-card fail">
      <i class="bi bi-x-circle-fill text-danger" style="font-size:1.5rem"></i>
      <div class="cc-body">
        <div class="cc-title">${action.isDirect ? 'Download' : 'Crawl'} failed</div>
        ${dl.error ? `<div class="cc-sub text-truncate">${esc(dl.error)}</div>` : ''}
      </div>
      <button class="pill-btn danger sm" onclick="DL.retry('${esc(id)}')">
        <i class="bi bi-arrow-repeat"></i> Retry
      </button>
      <button class="icon-btn sm" onclick="DL.remove('${esc(id)}')" aria-label="Dismiss">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>`;
    return;
  }
  const cardClass = previewable ? 'preview' : 'idle';
  const iconColor = previewable ? 'var(--mm-preview)' : 'var(--bs-primary)';
  const btnClass = previewable ? 'preview' : 'primary';
  el.innerHTML = `<div class="crawl-card ${cardClass}">
    <i class="bi ${action.icon}" style="color:${iconColor};font-size:1.7rem"></i>
    <div class="cc-body">
      <div class="cc-title">${action.idleTitle}</div>
      <div class="cc-sub">${action.idleSub}</div>
    </div>
    <button class="pill-btn ${btnClass}" onclick="startCrawl('${esc(id)}', this)">
      <i class="bi ${action.icon}"></i> ${action.label}
    </button>
  </div>`;
}

function startTrackPoller(trackId){
  stopTrackPoller();
  const tid = String(trackId);
  const tick = async () => {
    const cur = currentPath().startsWith('/track/') ? currentPath().split('/')[2] : null;
    if (String(cur) !== tid){ stopTrackPoller(); return; }
    const dl = DL.get(tid);
    const status = await apiCrawlStatus(tid);
    if (!status || status.download_status === 'completed' || (dl && dl.status === 'saving')){
      try {
        const fresh = await apiLookup(tid, 'song');
        const it = fresh.find(x => itemType(x) === 'track') || fresh[0];
        if (it && hasAudio(it)){
          cacheItems([it]);
          if (currentPath().startsWith('/track/')){ renderTrackPage(it); refreshLikes(); }
        }
      } catch {}
      if (dl && ['queued','crawling','saving'].includes(dl.status)) return;
      stopTrackPoller(); return;
    }
    const cached = getCached('track', tid);
    if (cached) renderCrawlCard(cached, status);
    if (['failed','stopped'].includes(status?.download_status)) stopTrackPoller();
  };
  tick();
  trackPoller = setInterval(tick, POLL_MS);
}

/* ══════════════════════════════════════════════════════════════
   LYRICS  —  sourced ONLY from the /lookup payload (inline)
   ══════════════════════════════════════════════════════════════ */
let syncedLyricsCache = { trackId:null, lines:null, synced:false, loading:false };

function numOrNull(v){ if (v == null) return null; const n = Number(v); return isFinite(n) ? n : null; }

const INSTRUMENTAL_RE = /^(instrumental|no\s*lyrics?|no\s*lyrics?\s*available|lyrics?\s*not\s*available|lyrics?\s*not\s*found|not\s*found|instrumental\s*\/\s*not\s*found|instrumental\s*\/\s*(no\s*)?lyrics?|only\s*music|music\s*only|\[?\s*instrumental\s*\]?|\(\s*instrumental\s*\)|♪+\s*instrumental\s*♪*|♫+\s*instrumental\s*♫*|\.{3,}|-+|—+)$/i;

function _isInstrumentalOnly(lines){
  if (!lines || !lines.length) return false;
  const joined = lines
    .map(l => String(l.text || '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!joined) return true;
  if (INSTRUMENTAL_RE.test(joined)) return true;
  if (joined.length <= 60){
    if (/instrumental/.test(joined)) return true;
    if (/not\s*found/.test(joined)) return true;
    if (/no\s*lyrics?/.test(joined)) return true;
    if (/^\W*$/.test(joined)) return true;
  }
  return false;
}

function parseLyricsPayload(r){
  let lines = [], rawText = '';
  const pickTime = l => numOrNull(l.time ?? l.startTime ?? l.start ?? l.timestamp ?? l.at ?? l.t ?? l.offset);
  const pickText = l => String(l.text ?? l.line ?? l.content ?? l.lyric ?? l.l ?? l.value ?? '');

  function ingest(node, depth){
    if (node == null || depth > 6) return;
    if (typeof node === 'string'){
      if (!rawText) rawText = node;
      return;
    }
    if (Array.isArray(node)){
      if (!lines.length){
        lines = node.map(l => typeof l === 'string'
          ? { time: null, text: l }
          : { time: pickTime(l), text: pickText(l) });
      }
      return;
    }
    if (typeof node !== 'object') return;

    if (node.text != null && typeof node.text === 'object'){
      ingest(node.text, depth + 1);
      if (lines.length || rawText) return;
    }
    if (typeof node.synced === 'string' && node.synced.trim()){
      if (!rawText) rawText = node.synced;
      return;
    }
    if (Array.isArray(node.synced) && node.synced.length){
      if (!lines.length) lines = node.synced.map(l => ({ time: pickTime(l), text: pickText(l) }));
      return;
    }
    if (Array.isArray(node.lines) && node.lines.length){
      if (!lines.length) lines = node.lines.map(l => ({ time: pickTime(l), text: pickText(l) }));
      return;
    }
    if (typeof node.plain === 'string' && node.plain.trim()){
      if (!rawText) rawText = node.plain;
      return;
    }
    if (typeof node.lyrics === 'string'){
      if (!rawText) rawText = node.lyrics;
      return;
    }
    if (typeof node.text === 'string'){
      if (!rawText) rawText = node.text;
      return;
    }
    if (typeof node.unsynced === 'string'){
      if (!rawText) rawText = node.unsynced;
      return;
    }
    if (Array.isArray(node.unsynced) && node.unsynced.length){
      if (!lines.length) lines = node.unsynced.map(t => ({ time: null, text: String(t) }));
      return;
    }
  }

  const L = r?.lyrics || r?.result || r?.data || r;
  ingest(L, 0);
  if (!lines.length && !rawText && typeof r === 'string') rawText = r;

  if (!lines.length && rawText){
    const timeRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
    const parsed = [];
    for (const line of String(rawText).split('\n')){
      timeRe.lastIndex = 0;
      const times = []; let m;
      while ((m = timeRe.exec(line)) !== null){
        const min = parseInt(m[1], 10), sec = parseInt(m[2], 10);
        const frac = m[3] ? parseInt(m[3].padEnd(3,'0').slice(0,3), 10)/1000 : 0;
        times.push(min*60 + sec + frac);
      }
      const text = line.replace(timeRe, '').trim();
      if (times.length) for (const t of times) parsed.push({ time: t, text });
      else parsed.push({ time: null, text });
    }
    lines = parsed;
  }

  if (_isInstrumentalOnly(lines)) return { lines: [], synced: false };

  const synced = lines.some(l => l.time != null);
  return { lines, synced };
}

function lyricsFromItem(item){
  if (!item) return null;
  const lyr = item.lyrics || item.attachments?.lyrics;
  if (!lyr) return null;
  try {
    const parsed = parseLyricsPayload(lyr);
    if (parsed && parsed.lines && parsed.lines.length) return parsed;
  } catch {}
  return null;
}

function loadLyrics(trackId, trackItem){
  const body = $('#lyricsBody');
  const badge = $('#lyricsBadge');
  if (badge) badge.style.display = 'none';

  const idStr = String(trackId);
  const item = trackItem || getCached('track', idStr);
  const fromItem = lyricsFromItem(item);

  if (fromItem){
    syncedLyricsCache = { trackId: idStr, lines: fromItem.lines, synced: fromItem.synced, loading: false };
    if (body && String(trackId) === String(lyricsTrackId)){
      if (badge) badge.style.display = fromItem.synced ? '' : 'none';
      renderLyricsInto(body, fromItem.lines, fromItem.synced);
    }
    return;
  }

  syncedLyricsCache = { trackId: idStr, lines: [], synced: false, loading: false };
  if (body && String(trackId) === String(lyricsTrackId)){
    renderLyricsInto(body, [], false);
  }
}

function getEffectiveScroller(container){
  if (container.scrollHeight > container.clientHeight + 2) return container;
  let p = container.parentElement;
  while (p && p !== document.body && p !== document.documentElement){
    const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
    p = p.parentElement;
  }
  return container;
}
function scrollLyricIntoView(container, el){
  const scroller = getEffectiveScroller(container);
  const cRect = scroller.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const delta = (eRect.top - cRect.top) - (cRect.height / 2 - eRect.height / 2);
  const target = Math.max(0, scroller.scrollTop + delta);
  if (Math.abs(target - scroller.scrollTop) > 1){
    scroller.scrollTop = target;
  }
}

function renderLyricsInto(container, lines, synced){
  if (!container) return;
  container._lyricsData = null;
  if (!lines || !lines.length){
    container.classList.remove('synced');
    container.innerHTML = `<div class="text-secondary" style="font-size:.85rem;padding:8px 0">No lyrics available for this track.</div>`;
    return;
  }
  if (synced){
    container.classList.add('synced');
    const frag = document.createDocumentFragment();
    const els = [];
    const elByLineIdx = new Map();
    const idxMap = [];
    lines.forEach((l, i) => {
      const el = document.createElement('div');
      if (l.time == null){
        el.className = 'lyric-line blank';
        el.innerHTML = '&nbsp;';
      } else {
        el.className = 'lyric-line';
        el.textContent = l.text || '\u00A0';
        el.dataset.time = l.time;
        el.addEventListener('click', () => {
          const t = parseFloat(el.dataset.time);
          if (isFinite(t)) audio.currentTime = t;
        });
        idxMap.push(i);
        elByLineIdx.set(i, el);
        els.push(el);
      }
      frag.appendChild(el);
    });
    container.replaceChildren(frag);
    container._lyricsData = { lines, els, idxMap, elByLineIdx, activeIdx: -1, userScrollUntil: 0 };
    if (!container._lyricsScrollBound){
      const markUserScroll = () => {
        const d = container._lyricsData;
        if (d) d.userScrollUntil = performance.now() + 4000;
      };
      container.addEventListener('wheel', markUserScroll, { passive: true });
      container.addEventListener('touchmove', markUserScroll, { passive: true });
      container.addEventListener('mousedown', markUserScroll, { passive: true });
      container._lyricsScrollBound = true;
    }
    updateSyncedLyricsFor(container, true);
  } else {
    container.classList.remove('synced');
    container.textContent = lines.map(l => l.text).join('\n');
  }
}

function updateSyncedLyricsFor(container, force){
  const data = container._lyricsData;
  if (!data || !data.lines.length) return;
  const t = audio.currentTime;
  const lines = data.lines;

  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++){
    const lt = lines[i].time;
    if (lt == null) continue;
    if (lt <= t + 0.08) activeIdx = i;
    else break;
  }
  if (activeIdx === data.activeIdx && !force) return;

  const prevIdx = data.activeIdx;
  data.activeIdx = activeIdx;

  if (prevIdx < activeIdx){
    const start = Math.max(0, prevIdx);
    for (let i = start; i < activeIdx; i++){
      const el = data.elByLineIdx.get(i);
      if (el && !el.classList.contains('passed')){
        el.classList.add('passed');
        el.classList.remove('active');
      }
    }
  } else if (prevIdx > activeIdx){
    for (let i = activeIdx + 1; i <= prevIdx; i++){
      const el = data.elByLineIdx.get(i);
      if (el) el.classList.remove('passed');
    }
    if (prevIdx >= 0){
      const el = data.elByLineIdx.get(prevIdx);
      if (el) el.classList.remove('active');
    }
  }

  if (activeIdx >= 0){
    const el = data.elByLineIdx.get(activeIdx);
    if (el){
      if (!el.classList.contains('active')){
        el.classList.remove('passed');
        el.classList.add('active');
      }
      if (getSettings().autoScrollLyrics && performance.now() > (data.userScrollUntil || 0)){
        scrollLyricIntoView(container, el);
      }
    }
  }
}

function updateVisibleLyrics(){
  const pageC = document.getElementById('lyricsBody');
  if (pageC && pageC._lyricsData && pageC.classList.contains('synced')){
    updateSyncedLyricsFor(pageC);
  }
  if (fpTab === 'lyrics' && $('#full')?.classList.contains('show')){
    const fpC = document.querySelector('.fp-lyrics-body');
    if (fpC && fpC._lyricsData) updateSyncedLyricsFor(fpC);
  }
}

function copyLyrics(){
  const t = $('#lyricsBody')?.innerText || '';
  if (!t) return;
  copyText(t);
}
function copyText(text){
  const done = () => toast('Copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => toast('Copy failed','danger'));
  else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { toast('Copy failed','danger'); }
    ta.remove();
  }
}

/* ══════════════════════════════════════════════════════════════
   PLAYER
   ══════════════════════════════════════════════════════════════ */
const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.85;

const Player = {
  track:null, queue:[], index:-1, playing:false,
  shuffle:false, repeat:'off', seeking:false, source:'MusicMan',
  sleepTimer: null
};

let fpTab = 'now';
function setFpTab(tab){
  fpTab = tab;
  $$('#fpHeadTabs .fp-head-tab').forEach(b => b.classList.toggle('active', b.dataset.fpTab === tab));
  renderFpTabBody();
}
function renderFpTabBody(){
  const body = $('#fpTabBody'); if (!body) return;
  if (fpTab === 'now') renderFpNow(body);
  else if (fpTab === 'queue') renderFpQueue(body);
  else renderFpLyrics(body);
  const badge = $('#fpQueueBadge');
  if (badge){ badge.textContent = Player.queue.length; badge.classList.toggle('on', Player.queue.length > 0); }
}

function syncPlayerUI(){
  const t = Player.track;
  const mini = $('#mini'); if (!mini) return;
  if (!t){ mini.classList.add('d-none'); document.title = 'MusicMan'; renderFpTabBody(); return; }
  mini.classList.remove('d-none');
  const art = getArtwork(t, 300) || t.artworkUrl || '';
  const artSmall = getArtwork(t, 100) || t.artworkUrl || art;
  const mi = $('#miniArt');
  if (artSmall){ mi.src = artSmall; mi.style.visibility = 'visible'; }
  else { mi.removeAttribute('src'); mi.style.visibility = 'hidden'; }
  $('#miniTitle').textContent  = t.trackName  || 'Track';
  $('#miniArtist').textContent = t.artistName || '';
  const fi = $('#fpArt');
  if (fi){
    if (art){ fi.src = art; fi.classList.remove('fp-art-ph'); }
    else { fi.removeAttribute('src'); fi.classList.add('fp-art-ph'); }
  }
  const bg = $('#fpBg');
  if (bg) bg.style.backgroundImage = art ? `url("${art}")` : '';
  refreshLikes(); renderFpTabBody(); syncPlayIcons(); syncSaveButton();
  document.title = `${t.trackName || 'MusicMan'} · MusicMan`;
}
function syncPlayIcons(){
  const cls = Player.playing ? 'bi-pause-fill' : 'bi-play-fill';
  const m = $('#miniPlayIcon'); if (m) m.className = `bi ${cls}`;
  const f = $('#fpPlayIcon');   if (f) f.className = `bi ${cls}`;

  const cur = Player.track ? String(Player.track.trackId) : null;
  $$('.row-item .row-play[data-play-id]').forEach(btn => {
    const id = String(btn.dataset.playId || '');
    const item = btn.closest('.row-item');
    const isCurrent = cur && id === cur;
    const icon = btn.querySelector('i');
    if (icon) icon.className = `bi ${isCurrent && Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}`;
    btn.classList.toggle('playing', !!isCurrent && Player.playing);
    if (item) item.classList.toggle('playing', !!isCurrent);
  });
}
function syncSaveButton(){
  const btn = $('#fpSaveBtn'); if (!btn) return;
  const id = Player.track?.trackId;
  if (!id){ btn.innerHTML = '<i class="bi bi-download"></i>'; return; }
  if (isCached(id)){ btn.innerHTML = '<i class="bi bi-cloud-check-fill text-success"></i>'; return; }
  const dl = DL.get(id);
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>`;
    return;
  }
  const action = dlActionFor(Player.track);
  btn.innerHTML = `<i class="bi ${action.icon}"></i>`;
}
let _fullPlayerEl = null;
function isFpVisible(){
  _fullPlayerEl = _fullPlayerEl || $('#full');
  return _fullPlayerEl?.classList.contains('show');
}

function setSeekUI(pct){
  const bar = $('#miniBar'); if (bar) bar.style.width = pct + '%';
  if (isFpVisible()){
    const seek = $('#fpSeek');
    if (seek && !Player.seeking){
      seek.value = Math.round(pct*10);
      seek.style.setProperty('--p', pct + '%');
    }
  }
}

audio.addEventListener('play',  () => { Player.playing = true;  syncPlayIcons(); syncSaveButton(); if (fpTab === 'queue') renderFpTabBody(); });
audio.addEventListener('pause', () => { Player.playing = false; syncPlayIcons(); if (fpTab === 'queue') renderFpTabBody(); });
audio.addEventListener('ended', () => onTrackEnded());
audio.addEventListener('loadedmetadata', () => {
  if (isFinite(audio.duration)){ const e = $('#fpDur'); if (e) e.textContent = fmtTime(audio.duration); }
});

let _timeRafPending = false;
let _lastLyricTick = 0;
let _lastProgressTick = 0;
audio.addEventListener('timeupdate', () => {
  if (_timeRafPending) return;
  _timeRafPending = true;
  requestAnimationFrame(() => {
    _timeRafPending = false;
    const d = audio.duration; if (!d || !isFinite(d)) return;
    const now = performance.now();

    if (now - _lastProgressTick >= PROGRESS_TICK_MS){
      _lastProgressTick = now;
      const pct = (audio.currentTime / d) * 100;
      setSeekUI(pct);
      if (isFpVisible()){
        const c = $('#fpCur'); if (c) c.textContent = fmtTime(audio.currentTime);
      }
    }
    if (now - _lastLyricTick >= LYRIC_TICK_MS){
      _lastLyricTick = now;
      updateVisibleLyrics();
    }
  });
});

audio.addEventListener('error', () => {
  if (audio.src && !audio.src.startsWith('blob:') && audio.src !== location.href) toast('Playback error', 'danger');
});

async function playItem(item, source='MusicMan'){
  if (!item) return;
  Player.source = source;
  const id = String(item.trackId || '');
  if (!id) return;

  if (isCached(id)) return playCachedById(id, item);

  let resolvedItem = item;
  let rawUrl = getPlayable(item);

  if (!rawUrl){
    const cached = getCached('track', id);
    if (cached){
      if (isCached(id)) return playCachedById(id, cached);
      const u = getPlayable(cached);
      if (u){ resolvedItem = cached; rawUrl = u; }
    }
  }

  if (!rawUrl){
    try {
      const r = await apiLookup(id, 'song');
      const fresh = r.find(x => itemType(x) === 'track') || r[0];
      if (fresh){
        cacheItems([fresh]);
        if (isCached(id)) return playCachedById(id, fresh);
        const u = getPlayable(fresh);
        if (u){ resolvedItem = fresh; rawUrl = u; }
      }
    } catch {}
  }

  if (!rawUrl){
    const dl = DL.get(id);
    if (dl && ['queued','crawling','saving'].includes(dl.status)){
      toast('Still preparing — try again in a moment', 'info');
    } else {
      toast('Audio not ready — download it first', 'warning');
    }
    return;
  }

  const previewOnly = !hasAudio(resolvedItem) && hasPreview(resolvedItem);

  audio.pause();
  if (audio.dataset.blobUrl){ try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch {} delete audio.dataset.blobUrl; }
  audio.src = proxyUrl(rawUrl);
  audio.load();
  audio.playbackRate = Number(getSettings().playbackRate) || 1;
  audio.play().catch(err => { if (err.name !== 'AbortError') toast('Cannot play', 'danger'); });
  Player.track = resolvedItem;
  pushRecentlyPlayed(resolvedItem);
  setQueueFromItem(resolvedItem, id);
  syncPlayerUI();
  ensureFpLyrics();
  if (previewOnly) toast('Preview playing — crawl for full track', 'info');
}
function setQueueFromItem(item, id){
  if (!id) return;
  const existing = Player.queue.findIndex(t => String(t.trackId) === id);
  if (existing >= 0){
    Player.queue[existing] = item;
    Player.index = existing;
  } else {
    Player.queue.push(item);
    Player.index = Player.queue.length - 1;
  }
}
async function playById(id){
  haptic(6);
  const cached = isCached(id);
  let it = getCached('track', id);
  if (!it){
    try {
      const r = await apiLookup(id, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch {}
  }
  if (!it && cached) it = { wrapperType:'track', trackId:String(id), trackName:'Cached track', artistName:'', attachments:{} };
  if (!it){ toast('Track not found', 'danger'); return; }
  playItem(it);
}
async function playCachedById(id, fallbackMeta){
  const e = await cacheGet(id);
  if (!e?.blob){ toast('Not available offline', 'danger'); return; }
  const m = e.meta || {};
  const url = URL.createObjectURL(e.blob);
  audio.pause();
  if (audio.dataset.blobUrl){ try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch {} }
  audio.dataset.blobUrl = url;
  audio.src = url;
  audio.playbackRate = Number(getSettings().playbackRate) || 1;
  audio.play().catch(() => {});
  const artworkUrl = m.artwork || getArtwork(fallbackMeta, 100);
  const fake = fallbackMeta && fallbackMeta.trackId ? {
    ...fallbackMeta,
    trackName: fallbackMeta.trackName || m.name || 'Cached track',
    artistName: fallbackMeta.artistName || m.artist || '',
    artistId: fallbackMeta.artistId || m.artistId || '',
    collectionName: fallbackMeta.collectionName || m.album || '',
    collectionId: fallbackMeta.collectionId || m.collectionId || '',
    attachments: {
      artworkUrls: artworkUrl ? [{ url: artworkUrl }] : (fallbackMeta.attachments?.artworkUrls || []),
      audioUrls: fallbackMeta.attachments?.audioUrls || [{ url:'local', quality:'320' }]
    }
  } : {
    wrapperType:'track', trackId:String(id),
    trackName: m.name || 'Cached track', artistName: m.artist || '',
    artistId: m.artistId || '', collectionName: m.album || '', collectionId: m.collectionId || '',
    attachments: { artworkUrls: m.artwork ? [{ url: m.artwork }] : [] }
  };
  Player.track = fake;
  pushRecentlyPlayed(fake);
  setQueueFromItem(fake, String(id));
  syncPlayerUI();
  ensureFpLyrics();
}
function togglePlay(){
  haptic(6);
  if (!audio.src){
    if (Player.queue.length) playItem(Player.queue[Math.max(0, Player.index)] || Player.queue[0]);
    return;
  }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function nextTrack(userInitiated = true){
  const q = Player.queue; if (!q.length) return;
  if (Player.repeat === 'one' && !userInitiated){ audio.currentTime = 0; audio.play().catch(()=>{}); return; }
  let next;
  if (Player.shuffle && q.length > 1){
    do { next = Math.floor(Math.random()*q.length); } while (next === Player.index);
  } else {
    next = Player.index + 1;
    if (next >= q.length){
      if (Player.repeat === 'all') next = 0;
      else { audio.pause(); audio.currentTime = 0; syncPlayIcons(); return; }
    }
  }
  Player.index = next;
  playItem(q[next], Player.source);
}
function prevTrack(){
  if (audio.currentTime > 3){ audio.currentTime = 0; return; }
  const q = Player.queue; if (!q.length) return;
  let prev = Player.index - 1;
  if (prev < 0) prev = Player.repeat === 'all' ? q.length - 1 : 0;
  Player.index = prev;
  playItem(q[prev], Player.source);
}
function onTrackEnded(){ nextTrack(false); }
function toggleShuffle(){
  Player.shuffle = !Player.shuffle;
  toast(Player.shuffle ? 'Shuffle on' : 'Shuffle off');
  if (fpTab === 'now') renderFpTabBody();
}
function cycleRepeat(){
  const order = ['off','all','one'];
  Player.repeat = order[(order.indexOf(Player.repeat) + 1) % 3];
  toast(Player.repeat === 'off' ? 'Repeat off' : Player.repeat === 'all' ? 'Repeat all' : 'Repeat one');
  if (fpTab === 'now') renderFpTabBody();
}
function openFullPlayer(tab){
  if (!Player.track) return;
  const el = $('#full');
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  if (tab) setFpTab(tab);
  else setFpTab(fpTab);
}
function closeFullPlayer(fromPop){
  const el = $('#full');
  if (!el.classList.contains('show')) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  el.style.transform = ''; el.style.opacity = '';
}
window.addEventListener('popstate', () => {
  if ($('#full')?.classList.contains('show')) closeFullPlayer(true);
});

(function initFullDrag(){
  const fp = $('#full'); if (!fp) return;
  let startY = 0, dy = 0, dragging = false;
  fp.addEventListener('touchstart', e => {
    if (fp.querySelector('.fp-tabbody')?.scrollTop > 0) return;
    if (e.target.closest('input,button,a')) return;
    dragging = true; startY = e.touches[0].clientY; dy = 0;
    fp.style.transition = 'none';
  }, { passive: true });
  fp.addEventListener('touchmove', e => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    fp.style.transform = `translateY(${dy}px)`;
    fp.style.opacity = String(Math.max(0.35, 1 - dy/520));
  }, { passive: true });
  fp.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false; fp.style.transition = '';
    const shouldClose = dy > 110;
    fp.style.transform = ''; fp.style.opacity = '';
    if (shouldClose) closeFullPlayer();
  });
})();

function renderFpNow(body){
  const t = Player.track;
  if (!t){
    body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note"></i>Nothing playing</div>`;
    return;
  }
  const art = getArtwork(t, 600) || t.artworkUrl || '';
  const liked = isLiked(t.trackId);
  const cached = isCached(t.trackId);
  const cur = fmtTime(audio.currentTime || 0);
  const dur = (audio.duration && isFinite(audio.duration)) ? fmtTime(audio.duration) : (t.trackTimeMillis ? fmtTime(t.trackTimeMillis/1000) : '0:00');
  const pct = (audio.duration && isFinite(audio.duration)) ? (audio.currentTime / audio.duration) * 100 : 0;
  const action = dlActionFor(t);

  let dlIcon = `<i class="bi ${action.icon}"></i>`;
  const dl = DL.get(t.trackId);
  if (cached) dlIcon = '<i class="bi bi-cloud-check-fill text-success"></i>';
  else if (dl && ['queued','crawling','saving'].includes(dl.status))
    dlIcon = `<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>`;

  const artistLine = t.artistId
    ? `<a class="fp-artist" href="${SCOPE}artist/${esc(t.artistId)}" data-link style="color:inherit">${esc(t.artistName || '')}</a>`
    : `<div class="fp-artist">${esc(t.artistName || '')}</div>`;

  body.innerHTML = `
    <div class="fp-body">
      ${art
        ? `<img id="fpArt" class="fp-art" src="${esc(art)}" alt="" decoding="async">`
        : `<div id="fpArt" class="fp-art fp-art-ph"><i class="bi bi-music-note"></i></div>`}
      <div class="fp-meta">
        <div class="fp-title">${esc(t.trackName || 'Track')}</div>
        ${artistLine}
      </div>
      <div class="fp-seek">
        <input id="fpSeek" class="mm-range" type="range" min="0" max="1000" value="${Math.round(pct*10)}" style="--p:${pct}%">
        <div class="fp-times"><span id="fpCur">${cur}</span><span id="fpDur">${dur}</span></div>
      </div>
      <div class="fp-controls">
        <button class="icon-btn ${Player.shuffle ? 'on' : ''}" onclick="toggleShuffle()" aria-label="Shuffle"><i class="bi bi-shuffle"></i></button>
        <button class="icon-btn lg" onclick="prevTrack()" aria-label="Previous"><i class="bi bi-skip-start-fill"></i></button>
        <button class="fp-play" onclick="togglePlay()" aria-label="Play/pause">
          <i id="fpPlayIcon" class="bi ${Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
        </button>
        <button class="icon-btn lg" onclick="nextTrack()" aria-label="Next"><i class="bi bi-skip-end-fill"></i></button>
        <button class="icon-btn ${Player.repeat !== 'off' ? 'on' : ''}" onclick="cycleRepeat()" aria-label="Repeat">
          <i class="bi ${Player.repeat === 'one' ? 'bi-repeat-1' : 'bi-repeat'}"></i>
        </button>
      </div>
      <div class="fp-volume">
        <i class="bi bi-volume-mute"></i>
        <input id="fpVol" class="mm-range vol" type="range" min="0" max="100" value="${Math.round(audio.volume*100)}" style="--p:${Math.round(audio.volume*100)}%" aria-label="Volume">
        <i class="bi bi-volume-up"></i>
      </div>
      <div class="fp-actions">
        <button class="icon-btn ${liked ? 'liked' : ''}" id="fpLikeBtn" onclick="toggleLikeCurrent()" aria-label="Like">
          <i id="fpLike" class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
        </button>
        <button class="icon-btn" id="fpSaveBtn" onclick="saveCurrentTrack()" aria-label="${action.label}">${dlIcon}</button>
        <button class="icon-btn" onclick="openPlaylistPicker('${esc(t.trackId)}')" aria-label="Add to playlist"><i class="bi bi-plus-lg"></i></button>
        <button class="icon-btn" onclick="openSleepTimer()" aria-label="Sleep timer"><i class="bi bi-moon" id="sleepIcon"></i></button>
      </div>
    </div>`;

  const seek = $('#fpSeek');
  seek?.addEventListener('pointerdown', () => { Player.seeking = true; });
  seek?.addEventListener('pointerup',   () => { Player.seeking = false; });
  seek?.addEventListener('input', e => {
    const p = Number(e.target.value)/10;
    e.target.style.setProperty('--p', p + '%');
    if (audio.duration && isFinite(audio.duration)){
      const c = $('#fpCur'); if (c) c.textContent = fmtTime((p/100)*audio.duration);
    }
  });
  seek?.addEventListener('change', e => {
    if (audio.duration && isFinite(audio.duration)) audio.currentTime = (Number(e.target.value)/1000)*audio.duration;
    Player.seeking = false;
  });
  const vol = $('#fpVol');
  vol?.addEventListener('input', e => {
    audio.volume = Number(e.target.value)/100;
    e.target.style.setProperty('--p', e.target.value + '%');
  });
}

function renderFpQueue(body){
  const q = Player.queue;
  const recent = getRecentlyPlayed();
  let html = '';
  if (!q.length){
    html += `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>Queue is empty</div>`;
  } else {
    html += `<div class="fp-list-head">
      <div class="fp-list-title">Now playing · ${q.length}</div>
      <div class="fp-list-actions">
        <button class="icon-btn sm" onclick="shuffleQueue()" aria-label="Shuffle"><i class="bi bi-shuffle"></i></button>
        <button class="icon-btn sm" onclick="clearQueue()" aria-label="Clear"><i class="bi bi-trash3"></i></button>
      </div>
    </div>`;
    html += q.map((tr, i) => qRow(tr, i)).join('');
  }
  const recentFiltered = recent.filter(r => !q.some(t => String(t.trackId) === String(r.trackId))).slice(0, 8);
  if (recentFiltered.length){
    html += `<div class="fp-list-head" style="margin-top:6px">
      <div class="fp-list-title">Recently played</div>
    </div>`;
    html += recentFiltered.map(r => {
      const a = r.artworkUrl || '';
      return `<div class="q-row" onclick="playById('${esc(r.trackId)}')">
        ${a ? `<img src="${esc(a)}" class="row-art" alt="" loading="lazy" decoding="async">`
            : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
        <div class="flex-grow-1 min-w-0">
          <div class="row-title text-truncate">${esc(r.trackName || 'Track')}</div>
          <div class="row-sub text-truncate">${esc(r.artistName || '')} · ${fmtAgo(r.at)}</div>
        </div>
      </div>`;
    }).join('');
  }
  body.innerHTML = html;
}

function qRow(tr, i){
  const active = i === Player.index;
  const art = getArtwork(tr, 100) || tr.artworkUrl || '';
  const last = Player.queue.length - 1;
  const indicator = active && Player.playing
    ? `<span class="q-bars"><span></span><span></span><span></span><span></span></span>`
    : (active ? `<i class="bi bi-play-fill text-primary"></i>` : '');
  return `<div class="q-row ${active ? 'active' : ''}" onclick="jumpQueue(${i})">
    <div class="q-drag" onclick="event.stopPropagation()">
      <button ${i === 0 ? 'disabled' : ''} onclick="moveQueueItem(${i}, -1)" aria-label="Up"><i class="bi bi-chevron-up"></i></button>
      <button ${i === last ? 'disabled' : ''} onclick="moveQueueItem(${i}, 1)" aria-label="Down"><i class="bi bi-chevron-down"></i></button>
    </div>
    ${art ? `<img src="${esc(art)}" class="row-art" alt="" loading="lazy" decoding="async">`
          : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="flex-grow-1 min-w-0">
      <div class="row-title text-truncate">${esc(tr.trackName || 'Track')}</div>
      <div class="row-sub text-truncate">${esc(tr.artistName || '')}</div>
    </div>
    ${indicator}
    <button class="icon-btn sm" onclick="event.stopPropagation();removeQueue(${i})" aria-label="Remove"><i class="bi bi-x-lg"></i></button>
  </div>`;
}
function moveQueueItem(i, dir){
  const j = i + dir;
  if (j < 0 || j >= Player.queue.length) return;
  const q = Player.queue;
  [q[i], q[j]] = [q[j], q[i]];
  if (Player.index === i) Player.index = j;
  else if (Player.index === j) Player.index = i;
  renderFpTabBody();
}
function shuffleQueue(){
  const q = Player.queue;
  if (q.length < 2) return;
  const current = Player.index >= 0 ? q[Player.index] : null;
  for (let i = q.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  if (current) Player.index = q.indexOf(current);
  renderFpTabBody();
  toast('Queue shuffled');
}
function jumpQueue(i){ if (i<0 || i>=Player.queue.length) return; Player.index = i; playItem(Player.queue[i], Player.source); }
function removeQueue(i){
  if (i<0 || i>=Player.queue.length) return;
  Player.queue.splice(i,1);
  if (i < Player.index) Player.index--;
  else if (i === Player.index) Player.index = Math.min(Player.index, Player.queue.length - 1);
  renderFpTabBody();
}
function clearQueue(){
  Player.queue = Player.track ? [Player.track] : [];
  Player.index = Player.track ? 0 : -1;
  renderFpTabBody();
  toast('Queue cleared');
}

async function ensureFpLyrics(){
  const t = Player.track; if (!t) return;
  const id = String(t.trackId);

  if (syncedLyricsCache.trackId === id && syncedLyricsCache.lines !== null) return;

  const fromTrack = lyricsFromItem(t);
  if (fromTrack){
    syncedLyricsCache = { trackId: id, lines: fromTrack.lines, synced: fromTrack.synced, loading: false };
    if (fpTab === 'lyrics') renderFpTabBody();
    return;
  }
  const cachedItem = getCached('track', id);
  if (cachedItem && cachedItem !== t){
    const fromCached = lyricsFromItem(cachedItem);
    if (fromCached){
      syncedLyricsCache = { trackId: id, lines: fromCached.lines, synced: fromCached.synced, loading: false };
      if (fpTab === 'lyrics') renderFpTabBody();
      return;
    }
  }

  try {
    const r = await apiLookup(id, 'song');
    const fresh = r.find(x => itemType(x) === 'track') || r[0];
    if (fresh){
      cacheItems([fresh]);
      if (!Player.track || String(Player.track.trackId) !== id) return;
      Player.track = fresh;
      const fromFresh = lyricsFromItem(fresh);
      if (fromFresh){
        syncedLyricsCache = { trackId: id, lines: fromFresh.lines, synced: fromFresh.synced, loading: false };
        if (fpTab === 'lyrics') renderFpTabBody();
        return;
      }
    }
  } catch {}

  syncedLyricsCache = { trackId: id, lines: [], synced: false, loading: false };
  if (fpTab === 'lyrics') renderFpTabBody();
}

let _lyricsFontSize = 0.92; // rem
function scaleLyricsFont(delta){
  _lyricsFontSize = Math.min(1.5, Math.max(0.7, _lyricsFontSize + delta));
  const body = document.querySelector('.fp-lyrics-body');
  if (body) body.style.fontSize = _lyricsFontSize + 'rem';
}

function renderFpLyrics(body){
  const t = Player.track;
  if (!t){
    body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>Nothing playing</div>`;
    return;
  }
  const id = String(t.trackId);
  if (syncedLyricsCache.trackId !== id || syncedLyricsCache.loading){
    body.innerHTML = `<div class="fp-lyrics-empty"><span class="spinner-border spinner-border-sm me-2"></span> Loading lyrics…</div>`;
    ensureFpLyrics();
    return;
  }
  if (!syncedLyricsCache.lines || !syncedLyricsCache.lines.length){
    body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>No lyrics available for this track.</div>`;
    return;
  }
  body.innerHTML = `
    <div class="d-flex justify-content-end gap-2 px-3 pt-2">
      <button class="pill-btn sm" onclick="scaleLyricsFont(-0.1)" aria-label="Smaller text"><i class="bi bi-zoom-out"></i> A-</button>
      <button class="pill-btn sm" onclick="scaleLyricsFont(0.1)" aria-label="Larger text"><i class="bi bi-zoom-in"></i> A+</button>
    </div>
    <div class="fp-lyrics-body" style="font-size:${_lyricsFontSize}rem"></div>`;
  renderLyricsInto(body.querySelector('.fp-lyrics-body'), syncedLyricsCache.lines, syncedLyricsCache.synced);
}

function openSleepTimer(){ sheet('#sheetSleep').show(); }
function setSleepTimer(minutes){
  sheet('#sheetSleep').hide();
  if (Player.sleepTimer){ clearTimeout(Player.sleepTimer); Player.sleepTimer = null; }
  const icon = $('#sleepIcon');
  if (!minutes){
    if (icon) icon.className = 'bi bi-moon';
    toast('Sleep timer off');
    return;
  }
  if (icon) icon.className = 'bi bi-moon-fill';
  Player.sleepTimer = setTimeout(() => {
    audio.pause();
    Player.sleepTimer = null;
    if (icon) icon.className = 'bi bi-moon';
    toast('Sleep timer — paused');
  }, minutes * 60 * 1000);
  toast(`Sleep timer · ${minutes} min`);
}
async function saveCurrentTrack(){
  const t = Player.track;
  if (!t?.trackId){ toast('Nothing playing', 'warning'); return; }
  const id = String(t.trackId);
  if (isCached(id)){ await exportCached(id); return; }
  const dl = DL.get(id);
  if (dl && ['queued','crawling','saving'].includes(dl.status)){ toast('Already in progress', 'warning'); return; }
  const fresh = getCached('track', id) || t;
  await startCrawlInternal(id, null, fresh);
  syncSaveButton();
}
function toggleLikeCurrent(){ if (Player.track?.trackId) toggleLike(Player.track); }

async function playIds(csv){
  const ids = String(csv || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length){ toast('Nothing to play'); return; }
  toast('Loading…');
  const items = [];
  for (const id of ids){
    let it = getCached('track', id);
    if (!it){
      try {
        const r = await apiLookup(id, 'song');
        it = r.find(x => itemType(x) === 'track') || r[0];
        if (it) cacheItems([it]);
      } catch {}
    }
    if (!it && isCached(id)) it = { wrapperType:'track', trackId:String(id), trackName:'Cached track', artistName:'', attachments:{} };
    if (it) items.push(it);
  }
  if (!items.length){ toast('Could not load tracks', 'danger'); return; }
  Player.queue = items;
  Player.index = 0;
  renderFpTabBody();
  playItem(items[0], Player.source);
}

/* ══════════════════════════════════════════════════════════════
   BULK ACTIONS
   ══════════════════════════════════════════════════════════════ */
let _pageTracks = [];

function addAllToQueue(items){
  const list = (items || []).filter(it => it && it.trackId);
  if (!list.length){ toast('Nothing to add', 'warning'); return; }
  let added = 0;
  const existing = new Set(Player.queue.map(q => String(q.trackId)));
  for (const it of list){
    const id = String(it.trackId);
    if (existing.has(id)) continue;
    Player.queue.push(it); existing.add(id); added++;
  }
  if (Player.index < 0 && Player.queue.length) Player.index = 0;
  renderFpTabBody();
  haptic(8);
  toast(added ? `Added ${added} track${added === 1 ? '' : 's'} to queue` : 'Already in queue', added ? 'success' : 'warning');
}
function toggleLikeAll(items){
  const list = (items || []).filter(it => it && it.trackId);
  if (!list.length){ toast('Nothing to like', 'warning'); return; }
  const likes = getLikes();
  const itemIds = new Set(list.map(it => String(it.trackId)));
  const allLiked = list.every(it => likes.some(l => String(l.trackId) === String(it.trackId)));
  if (allLiked){
    const next = likes.filter(l => !itemIds.has(String(l.trackId)));
    ls.set(KEY.likes, next);
    toast(`Removed ${list.length} from Liked`);
  } else {
    const existing = new Set(likes.map(l => String(l.trackId)));
    let added = 0;
    for (const it of list){
      const id = String(it.trackId);
      if (existing.has(id)) continue;
      likes.unshift(makeLikeEntry(it)); existing.add(id); added++;
    }
    ls.set(KEY.likes, likes);
    toast(added ? `Liked ${added} track${added === 1 ? '' : 's'}` : 'Already liked');
  }
  haptic(12);
  refreshLikes();
  refreshPage();
}
async function refreshPage(){
  const y = MAIN().scrollTop;
  try { await route(); } catch (e){ console.warn(e); }
  MAIN().scrollTop = y;
}

/* ══════════════════════════════════════════════════════════════
   TRACK MENU
   ══════════════════════════════════════════════════════════════ */
const menuCtx = { trackId:null, playlistId:null };

async function openTrackMenu(trackId, playlistId){
  if (!trackId) return;
  menuCtx.trackId = String(trackId);
  menuCtx.playlistId = playlistId || null;
  let it = getCached('track', trackId);
  if (!it){
    try {
      const r = await apiLookup(trackId, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch {}
  }
  if (!it){ toast('Track not available', 'danger'); return; }
  const id = String(trackId);
  const liked   = isLiked(id);
  const cached  = isCached(id);
  const dl      = DL.get(id);
  const art     = getArtwork(it, 100);
  const action  = dlActionFor(it);

  const rows = [];
  rows.push(`<button class="sheet-item" onclick="menuAction('play')"><i class="bi bi-play-circle text-primary"></i><span>Play track</span></button>`);
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    rows.push(`<button class="sheet-item" onclick="menuAction('openDl')"><i class="bi ${action.icon} text-info"></i><span>View ${action.isDirect ? 'download' : 'crawl'} progress</span></button>`);
    rows.push(`<button class="sheet-item danger" onclick="menuAction('cancelDl')"><i class="bi bi-x-circle"></i><span>Cancel ${action.isDirect ? 'download' : 'crawl'}</span></button>`);
  } else if (cached){
    rows.push(`<button class="sheet-item" onclick="menuAction('export')"><i class="bi bi-file-earmark-arrow-down text-primary"></i><span>Save as file</span></button>`);
    rows.push(`<button class="sheet-item danger" onclick="menuAction('uncache')"><i class="bi bi-trash3"></i><span>Remove offline copy</span></button>`);
  } else {
    rows.push(`<button class="sheet-item" onclick="menuAction('download')"><i class="bi ${action.icon} text-primary"></i><span>${action.label}</span></button>`);
  }

  rows.push(`<button class="sheet-item" onclick="menuAction('next')"><i class="bi bi-skip-end-fill"></i><span>Play next</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('queue')"><i class="bi bi-list-ul"></i><span>Add to queue</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('like')"><i class="bi ${liked ? 'bi-heart-fill text-danger' : 'bi-heart'}"></i><span>${liked ? 'Remove from Liked' : 'Add to Liked'}</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('playlist')"><i class="bi bi-plus-circle"></i><span>Add to playlist</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('share')"><i class="bi bi-share"></i><span>Share</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('details')"><i class="bi bi-info-circle"></i><span>Track details</span></button>`);
  if (it.collectionId) rows.push(`<button class="sheet-item" onclick="menuAction('album')"><i class="bi bi-disc"></i><span>Go to album</span></button>`);
  if (it.artistId)     rows.push(`<button class="sheet-item" onclick="menuAction('artist')"><i class="bi bi-person"></i><span>Go to artist</span></button>`);
  if (menuCtx.playlistId) rows.push(`<button class="sheet-item danger" onclick="menuAction('removeFromPl')"><i class="bi bi-x-circle"></i><span>Remove from playlist</span></button>`);

  $('#sheetTrackBody').innerHTML = `
    <div class="d-flex align-items-center gap-3 px-3 pb-3 pt-1">
      ${art ? `<img src="${esc(art)}" width="52" height="52" class="row-art" alt="" loading="lazy" decoding="async">`
            : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
      <div class="min-w-0">
        <div class="fw-bold text-truncate">${esc(it.trackName || 'Track')}</div>
        <div class="row-sub text-truncate">${esc(it.artistName || '')}</div>
      </div>
    </div>
    <div class="px-2">${rows.join('')}</div>`;

  sheet('#sheetTrack').show();
}
async function menuAction(action){
  const id = menuCtx.trackId;
  const plId = menuCtx.playlistId;
  sheet('#sheetTrack').hide();
  if (!id) return;
  let it = getCached('track', id);
  if (!it){
    try {
      const r = await apiLookup(id, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch {}
  }
  switch (action){
    case 'details':
      closeFullPlayer();
      go('/track/' + id);
      break;
    case 'play':
      playById(id);
      break;
    case 'next': {
      if (!it) return;
      Player.queue.splice(Player.index + 1, 0, it);
      toast('Playing next');
      renderFpTabBody();
      break;
    }
    case 'queue': {
      if (!it) return;
      if (Player.queue.some(t => String(t.trackId) === id)){
        toast('Already in queue','warning');
        return;
      }
      Player.queue.push(it);
      if (Player.index < 0) Player.index = 0;
      toast('Added to queue');
      renderFpTabBody();
      break;
    }
    case 'share':
      await shareTrack(id, it);
      break;
    case 'like':
      toggleLikeById(id);
      break;
    case 'playlist':
      openPlaylistPicker(id);
      break;
    case 'download':
      if (it) await startCrawlInternal(id, null, it);
      break;
    case 'export':
      await exportCached(id);
      break;
    case 'uncache':
      await removeCached(id);
      break;
    case 'openDl':
      closeFullPlayer();
      go('/library/downloads');
      break;
    case 'cancelDl':
      DL.remove(id);
      toast('Cancelled');
      break;
    case 'album':
      if (it?.collectionId){
        closeFullPlayer();
        go('/album/' + it.collectionId);
      }
      break;
    case 'artist':
      if (it?.artistId){
        closeFullPlayer();
        go('/artist/' + it.artistId);
      }
      break;
    case 'removeFromPl':
      if (plId){
        removeFromPlaylist(plId, id);
        toast('Removed');
      }
      break;
  }
}
function fpMoreMenu(){
  if (!Player.track?.trackId) return;
  openTrackMenu(Player.track.trackId);
}

/* ══════════════════════════════════════════════════════════════
   SHARE
   ══════════════════════════════════════════════════════════════ */
async function shareTrack(id, it){
  const url = location.origin + (BASE || '') + '/track/' + id;
  const title = it?.trackName || 'Track';
  const text = `${title}${it?.artistName ? ' — ' + it.artistName : ''}`;
  if (navigator.share){
    try { await navigator.share({ title, text, url }); toast('Shared'); }
    catch (e) { if (e.name !== 'AbortError') copyText(url); }
  } else copyText(url);
}

/* ══════════════════════════════════════════════════════════════
   PLAYLIST PICKER
   ══════════════════════════════════════════════════════════════ */
let pickerItems = [];
function openPlaylistPicker(trackId){
  const id = String(trackId);
  const cached = getCached('track', id);
  if (cached) return openPlaylistPickerForItems([cached]);
  (async () => {
    try {
      const r = await apiLookup(id, 'song');
      const it = r.find(x => itemType(x) === 'track') || r[0];
      if (it){ cacheItems([it]); openPlaylistPickerForItems([it]); }
      else toast('Track not available', 'danger');
    } catch { toast('Track not available', 'danger'); }
  })();
}
function openPlaylistPickerForItems(items){
  pickerItems = (items || []).filter(it => it && it.trackId);
  if (!pickerItems.length) return;
  const titleEl = $('#sheetPlTitle');
  if (titleEl) titleEl.textContent = pickerItems.length > 1
    ? `Add ${pickerItems.length} tracks to playlist` : 'Add to playlist';
  const pls = getPlaylists();
  const body = $('#sheetPlBody');
  if (!pls.length){
    body.innerHTML = `<div class="state" style="padding:30px 20px"><i class="bi bi-music-note-list"></i><p>No playlists yet</p></div>`;
  } else {
    body.innerHTML = pls.map(p => {
      const cover = p.tracks.find(t => t.artworkUrl)?.artworkUrl || '';
      return `<button class="sheet-item" onclick="pickPlaylist('${esc(p.id)}')">
        ${cover ? `<img src="${esc(cover)}" width="42" height="42" class="row-art" alt="" loading="lazy" decoding="async">`
                : `<div class="row-art row-art-ph"><i class="bi bi-music-note-list"></i></div>`}
        <span class="flex-grow-1 min-w-0">
          <span class="d-block text-truncate fw-semibold">${esc(p.name)}</span>
          <span class="sub">${p.tracks.length} track${p.tracks.length !== 1 ? 's' : ''}</span>
        </span>
        <i class="bi bi-plus-lg text-primary"></i>
      </button>`;
    }).join('');
  }
  sheet('#sheetPl').show();
}
async function pickPlaylist(plId){
  if (!pickerItems.length) return;
  const all = getPlaylists();
  const pl = all.find(p => p.id === plId); if (!pl) return;
  let added = 0;
  const existing = new Set(pl.tracks.map(t => String(t.trackId)));
  for (const it of pickerItems){
    const id = String(it.trackId);
    if (existing.has(id)) continue;
    pl.tracks.push(makeLikeEntry(it)); existing.add(id); added++;
  }
  savePlaylists(all);
  sheet('#sheetPl').hide();
  haptic(10);
  toast(added ? `Added ${added} track${added === 1 ? '' : 's'} to "${pl.name}"` : 'Already in playlist', added ? 'success' : 'warning');
  pickerItems = [];
}
async function newPlaylistPrompt(){
  const itemsToAdd = pickerItems.slice();
  pickerItems = [];
  sheet('#sheetPl').hide();
  const name = await askText('New playlist', '', 'Playlist name');
  if (!name) return;
  const pl = createPlaylist(name);
  if (!pl) return;
  if (itemsToAdd.length){
    const all = getPlaylists();
    const p = all.find(x => x.id === pl.id);
    if (p){
      const existing = new Set(p.tracks.map(t => String(t.trackId)));
      for (const it of itemsToAdd){
        const id = String(it.trackId);
        if (existing.has(id)) continue;
        p.tracks.push(makeLikeEntry(it)); existing.add(id);
      }
      savePlaylists(all);
    }
  }
  if (currentPath().startsWith('/library/playlists')) go('/library/playlists/' + pl.id);
}

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD / CRAWL ACTIONS
   ══════════════════════════════════════════════════════════════ */
async function startCrawl(trackId, btn){
  const id = String(trackId);
  const it0 = getCached('track', id);
  const action = it0 ? dlActionFor(it0) : { icon: 'bi-cloud-arrow-down', label: 'Crawl' };
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>'; }
  try {
    let it = it0;
    if (!it){
      try {
        const r = await apiLookup(trackId, 'song');
        it = r.find(x => itemType(x) === 'track') || r[0];
        if (it) cacheItems([it]);
      } catch {}
    }
    if (!it){ toast('Track unavailable', 'danger'); return; }
    await DL.add(it);
    haptic(12);
    if (currentPath() === `/track/${trackId}`){
      const status = await apiCrawlStatus(trackId);
      renderCrawlCard(it, status);
      startTrackPoller(trackId);
    }
  } catch (e){
    toast((action.label) + ' failed: ' + e.message, 'danger');
  } finally {
    if (btn){
      btn.disabled = false;
      btn.innerHTML = `<i class="bi ${action.icon}"></i> ${action.label}`;
    }
  }
}
async function startCrawlInternal(trackId, btn, knownTrack){
  const it0 = knownTrack || getCached('track', trackId);
  const action = it0 ? dlActionFor(it0) : { icon: 'bi-cloud-arrow-down', label: 'Crawl' };
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>'; }
  try {
    let it = it0 || (await DL._fetchTrack(trackId));
    if (!it){ toast('Track unavailable', 'danger'); return; }
    await DL.add(it);
  } finally {
    if (btn){
      btn.disabled = false;
      btn.innerHTML = `<i class="bi ${action.icon}"></i> ${action.label}`;
    }
  }
}
async function crawlAll(type, id, btn){
  const orig = btn?.innerHTML;
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" style="width:14px;height:14px;border-width:2px"></span>Starting…'; }
  try {
    const body = {};
    if (type === 'track') body.trackId = cleanId(id);
    else if (type === 'collection') body.albumId = cleanId(id);
    else if (type === 'artist') body.artistId = cleanId(id);
    const r = await apiQueueAdd(body);
    const added   = r.added_count   ?? r.added   ?? 0;
    const skipped = r.skipped_count ?? r.skipped ?? 0;
    toast(`Queued ${added}${skipped ? ` · ${skipped} skipped` : ''}`);
    haptic(12);
  } catch (e){
    toast('Crawl failed: ' + e.message, 'danger');
  } finally {
    if (btn){ btn.disabled = false; btn.innerHTML = orig; }
  }
}
async function removeCached(id){
  await cacheDel(id);
  cachedIds.delete(String(id));
  toast('Removed from offline');
  refreshCurrentView();
}
async function clearAllCache(){
  const ok = await askConfirm('Clear offline cache?', 'All downloaded tracks will be deleted.', 'Clear all');
  if (!ok) return;
  await cacheClear();
  cachedIds.clear();
  toast('Offline cache cleared');
  updateSettingsSheet();
  if (isLibraryDlRoute()) renderDownloads();
  if (isTrackRoute()){ const t = getCached('track', currentPath().split('/')[2]); if (t) renderCrawlCard(t, null); }
}
function refreshCurrentView(){
  const p = currentPath();
  if (p === '/library/downloads') renderDownloads();
  else route();
}

/* ══════════════════════════════════════════════════════════════
   LIBRARY VIEWS
   ══════════════════════════════════════════════════════════════ */
function libraryTabs(active){
  const activeDl = DL.active().length + DL.ready().length;
  const followed = getFollowed().length;
  const item = (key, label, badge) => `<a href="${SCOPE}library/${key}" data-link class="${active === key ? 'active' : ''}">
    ${label}${badge !== undefined ? `<span class="seg-badge ${badge > 0 ? 'on' : ''}">${badge}</span>` : ''}
  </a>`;
  return `<div class="seg">
    ${item('likes', 'Liked')}
    ${item('following', 'Following', followed)}
    ${item('playlists', 'Lists')}
    ${item('downloads', 'Offline', activeDl)}
  </div>`;
}
function likesToItems(){
  return getLikes().map(l => ({
    wrapperType:'track',
    trackId: l.trackId, trackName: l.trackName,
    artistName: l.artistName, artistId: l.artistId,
    collectionName: l.collectionName, collectionId: l.collectionId,
    attachments: {
      artworkUrls: l.artworkUrl ? [{ url: l.artworkUrl }] : [],
      audioUrls: isCached(l.trackId) ? [{ url:'local', quality:'320' }] : []
    }
  }));
}
function viewLikes(){
  const likes = getLikes();
  let html = libraryTabs('likes');
  if (!likes.length){
    html += emptyState('heart', 'No liked songs yet', 'Tap the heart on any track to save it here.');
  } else {
    const items = likesToItems();
    _pageTracks = items;
    const ids = items.map(x => x.trackId).join(',');
    html += `<div class="d-flex align-items-center px-3 pt-4 pb-3">
      <div class="flex-grow-1 fw-bold">${likes.length} liked song${likes.length !== 1 ? 's' : ''}</div>
      <button class="pill-btn success" onclick="playIds('${esc(ids)}')"><i class="bi bi-play-fill"></i> Play all</button>
    </div>`;
    html += items.map(t => trackRow(t)).join('');
  }
  MAIN().innerHTML = html;
}
function viewFollowing(){
  const list = getFollowed();
  let html = libraryTabs('following');
  if (!list.length){
    html += emptyState('person-check', 'Not following any artists', 'Follow artists to see them here.');
  } else {
    html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
      <div class="flex-grow-1 fw-bold">${list.length} artist${list.length !== 1 ? 's' : ''}</div>
    </div>`;
    html += list.map(a => `
      <div class="row-item">
        <a class="row-info" href="${SCOPE}artist/${esc(a.artistId)}" data-link>
          ${a.artwork
            ? `<img class="row-art" style="border-radius:50%" src="${esc(a.artwork)}" loading="lazy" decoding="async" alt="">`
            : `<div class="row-art row-art-ph" style="border-radius:50%"><i class="bi bi-person-fill"></i></div>`}
          <div class="min-w-0 flex-grow-1">
            <div class="row-title text-truncate">${esc(a.artistName || 'Artist')}</div>
            <div class="row-sub text-truncate">${esc(a.primaryGenreName || 'Artist')}</div>
          </div>
        </a>
        <button class="icon-btn sm text-primary" onclick="event.preventDefault();event.stopPropagation();toggleFollow('${esc(a.artistId)}')" aria-label="Unfollow">
          <i class="bi bi-check-lg"></i>
        </button>
      </div>`).join('');
  }
  MAIN().innerHTML = html;
}
function viewPlaylists(){
  const pls = getPlaylists();
  let html = libraryTabs('playlists');
  html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
    <div class="flex-grow-1 fw-bold">Your playlists</div>
    <button class="pill-btn primary" onclick="newPlaylistPrompt()"><i class="bi bi-plus-lg"></i> New</button>
  </div>`;
  if (!pls.length){
    html += emptyState('music-note-list', 'No playlists yet', 'Create one to organize your music.');
  } else {
    html += pls.map(pl => {
      const cover = pl.tracks.find(t => t.artworkUrl)?.artworkUrl || '';
      return `<a class="row-item" href="${SCOPE}library/playlists/${esc(pl.id)}" data-link>
        ${cover ? `<img class="row-art" src="${esc(cover)}" alt="" loading="lazy" decoding="async">`
                : `<div class="row-art row-art-ph"><i class="bi bi-music-note-list"></i></div>`}
        <div class="row-info">
          <div class="min-w-0 flex-grow-1">
            <div class="row-title text-truncate">${esc(pl.name)}</div>
            <div class="row-sub text-truncate">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}</div>
          </div>
          <i class="bi bi-chevron-right text-secondary"></i>
        </div>
      </a>`;
    }).join('');
  }
  MAIN().innerHTML = html;
}
function renderPlaylistDetail(plId){
  const pl = getPlaylists().find(p => p.id === plId);
  if (!pl){ MAIN().innerHTML = emptyState('music-note-list', 'Playlist not found'); return; }
  const items = playlistToItems(plId);
  const ids = items.map(x => String(x.trackId)).join(',');
  let html = `<div class="pb-4">`;
  html += backBtn(SCOPE + 'library/playlists');
  html += `<div class="px-3 pt-1">
    <div style="font-size:1.35rem;font-weight:800;letter-spacing:-.02em" class="text-truncate">${esc(pl.name)}</div>
    <div class="text-secondary" style="font-size:.8rem">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}${pl.createdAt ? ` · ${fmtAgo(pl.createdAt)}` : ''}</div>
  </div>`;
  html += `<div class="action-bar">
    ${items.length ? `<button class="pill-btn success" onclick="playIds('${esc(ids)}')"><i class="bi bi-play-fill"></i> Play</button>` : ''}
    ${items.length ? `<button class="pill-btn sm" onclick="addAllToQueue(playlistToItems('${esc(plId)}'))"><i class="bi bi-list-ul"></i> Queue</button>` : ''}
    <button class="icon-btn" style="background:rgba(var(--bs-body-color-rgb),.09)"
            onclick="playlistMore('${esc(plId)}')" aria-label="More"><i class="bi bi-three-dots"></i></button>
  </div>`;
  html += items.length
    ? items.map(t => trackRow(t, { playlistId: plId })).join('')
    : emptyState('music-note', 'This playlist is empty', 'Add songs from the ⋮ menu.');
  html += `</div>`;
  MAIN().innerHTML = html;
}
function playlistMore(plId){
  const rows = [
    `<button class="sheet-item" onclick="closeAllSheets(); renamePlaylist('${esc(plId)}')"><i class="bi bi-pencil"></i><span>Rename playlist</span></button>`,
    `<button class="sheet-item danger" onclick="closeAllSheets(); deletePlaylist('${esc(plId)}')"><i class="bi bi-trash3"></i><span>Delete playlist</span></button>`,
  ];
  $('#sheetTrackBody').innerHTML = `
    <div class="px-3 pb-2 pt-1"><div class="fw-bold">Playlist actions</div></div>
    <div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}
function playlistToItems(plId){
  const pl = getPlaylists().find(p => p.id === plId);
  if (!pl) return [];
  return pl.tracks.map(l => ({
    wrapperType:'track',
    trackId: l.trackId, trackName: l.trackName,
    artistName: l.artistName, artistId: l.artistId,
    collectionName: l.collectionName, collectionId: l.collectionId,
    attachments: {
      artworkUrls: l.artworkUrl ? [{ url: l.artworkUrl }] : [],
      audioUrls: isCached(l.trackId) ? [{ url:'local', quality:'320' }] : []
    }
  }));
}
async function renamePlaylist(id){
  const pl = getPlaylists().find(p => p.id === id); if (!pl) return;
  const name = await askText('Rename playlist', pl.name, 'Playlist name');
  if (!name) return;
  const all = getPlaylists();
  const t = all.find(p => p.id === id); if (!t) return;
  t.name = name; savePlaylists(all);
  if (isPlaylistDetailRoute(id)) renderPlaylistDetail(id);
  else viewPlaylists();
  toast('Renamed');
}
async function deletePlaylist(id){
  const pl = getPlaylists().find(p => p.id === id); if (!pl) return;
  const ok = await askConfirm('Delete playlist?', `"${pl.name}" and its contents will be removed.`, 'Delete');
  if (!ok) return;
  savePlaylists(getPlaylists().filter(p => p.id !== id));
  toast('Playlist deleted');
  go('/library/playlists');
}

/* ══════════════════════════════════════════════════════════════
   DOWNLOADS VIEW
   ══════════════════════════════════════════════════════════════ */
let dlUnsubscribe = null;
function renderDownloads(){
  MAIN().innerHTML = libraryTabs('downloads')
    + `<div id="dlContent"><div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></div>`;
  if (dlUnsubscribe) dlUnsubscribe();
  dlUnsubscribe = DL.onChange(() => { if (isLibraryDlRoute()) updateDlLists(); });
  updateDlLists();
}
async function updateDlLists(){
  const wrap = $('#dlContent'); if (!wrap) return;
  const active = DL.active();
  const ready  = DL.ready();
  const failed = DL.failed();
  const all = await cacheAll();
  const totalSize = all.reduce((s,e) => s + (e.size || 0), 0);

  let html = '';
  if (active.length){
    html += `<h6 class="sec-title tight">In progress · ${active.length}</h6>`;
    html += active.map(it => dlRowHtml(it)).join('');
  }
  if (ready.length){
    html += `<h6 class="sec-title tight">Ready to download · ${ready.length}</h6>`;
    html += ready.map(it => dlRowHtml(it)).join('');
  }
  if (failed.length){
    html += `<h6 class="sec-title tight">Needs attention · ${failed.length}</h6>`;
    html += failed.map(it => dlRowHtml(it)).join('');
  }
  html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
    <div class="flex-grow-1 min-w-0">
      <div class="fw-bold">Available offline</div>
      <div class="text-secondary" style="font-size:.74rem">${all.length} track${all.length !== 1 ? 's' : ''} · ${fmtSize(totalSize)}</div>
    </div>
    ${all.length ? `<div class="d-flex gap-2">
      <button class="pill-btn primary sm" onclick="exportAllCached()"><i class="bi bi-download"></i></button>
      <button class="pill-btn danger sm" onclick="clearAllCache()"><i class="bi bi-trash3"></i></button>
    </div>` : ''}
  </div>`;

  if (!all.length && !active.length && !ready.length && !failed.length){
    html += emptyState('download', 'Nothing offline yet', 'Download a track from any menu.');
  } else if (!all.length){
    html += `<div class="state" style="padding:20px 24px"><p style="font-size:.8rem">Nothing saved yet — start a download above.</p></div>`;
  } else {
    html += all.map(e => {
      const m = e.meta || {};
      const art = m.artwork || '';
      const id = String(e.trackId);
      const playing = Player.track && String(Player.track.trackId) === id;
      return `<div class="dl-row">
        <button class="row-play ${playing && Player.playing ? 'playing' : ''}" onclick="playCachedById('${esc(id)}')" aria-label="Play">
          <i class="bi ${playing && Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
        </button>
        <a class="row-info" href="${SCOPE}track/${esc(id)}" data-link>
          ${art ? `<img class="row-art" src="${esc(art)}" alt="" loading="lazy" decoding="async">`
                : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
          <div class="min-w-0 flex-grow-1">
            <div class="row-title text-truncate">${esc(m.name || id)}</div>
            <div class="row-sub text-truncate">${esc(m.artist || '')} · ${fmtSize(e.size || 0)}</div>
          </div>
        </a>
        <button class="icon-btn sm text-primary" onclick="exportCached('${esc(id)}')" aria-label="Save as file">
          <i class="bi bi-file-earmark-arrow-down"></i>
        </button>
        <button class="icon-btn sm text-danger" onclick="removeCached('${esc(id)}')" aria-label="Remove">
          <i class="bi bi-trash3"></i>
        </button>
      </div>`;
    }).join('');
  }
  wrap.innerHTML = html;
}
function dlRowHtml(it){
  const isActive = ['queued','crawling','saving'].includes(it.status);
  const isReady  = it.status === 'ready';
  const isFailed = ['failed','paused'].includes(it.status);
  const pct = Math.max(0, Math.min(100, Math.round(Number(it.percent ?? it.progress ?? it.pct ?? 0))));
  const statusLabel = (it.status === 'saving' || it.status === 'crawling')
    ? `${it.status === 'saving' ? 'Downloading' : 'Crawling'} · ${pct}%`
    : ({ queued:'Queued', ready:'Ready', failed:'Failed', paused:'Paused' }[it.status] || it.status);
  const statusClass = {
    queued:'queued', crawling:'crawling', saving:'saving',
    ready:'ready', failed:'error', paused:'error'
  }[it.status] || 'queued';
  const progressClass = isFailed ? 'error' : it.status === 'saving' ? 'saving' : '';
  let rightAction = '';
  if (isActive){
    rightAction = `<button class="icon-btn sm text-danger" onclick="DL.remove('${esc(it.trackId)}')" aria-label="Cancel"><i class="bi bi-x-lg"></i></button>`;
  } else if (isReady){
    rightAction = `<button class="pill-btn success sm" onclick="DL.saveNow('${esc(it.trackId)}')"><i class="bi bi-download"></i> Save</button>
      <button class="icon-btn sm text-danger" onclick="DL.remove('${esc(it.trackId)}')" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>`;
  } else if (isFailed){
    rightAction = `<button class="pill-btn danger sm" onclick="DL.retry('${esc(it.trackId)}')"><i class="bi bi-arrow-repeat"></i> Retry</button>
      <button class="icon-btn sm" onclick="DL.remove('${esc(it.trackId)}')" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>`;
  }
  const sizeInfo = it.status === 'saving' && it.totalBytes ? `${fmtSize(it.bytes)} / ${fmtSize(it.totalBytes)}` : '';
  return `<div class="dl-row">
    ${it.artwork
      ? `<img class="row-art" src="${esc(it.artwork)}" alt="" loading="lazy" decoding="async">`
      : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="dl-body">
      <div class="d-flex align-items-center gap-2 mb-1">
        <div class="dl-title text-truncate flex-grow-1 min-w-0">${esc(it.name)}</div>
        <span class="dl-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="dl-sub text-truncate">${esc(it.artist || '')}${sizeInfo ? ' · ' + sizeInfo : ''}</div>
      ${isActive ? `<div class="dl-progress ${progressClass}"><div style="width:${pct}%"></div></div>` : ''}
      ${isFailed && it.error ? `<div class="dl-sub text-danger text-truncate">${esc(it.error)}</div>` : ''}
    </div>
    ${rightAction}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════════════════ */
function openSettings(){ sheet('#sheetSettings').show(); updateSettingsSheet(); }
async function updateSettingsSheet(){
  const s = getSettings();
  $$('#setTheme button').forEach(b => b.classList.toggle('on', b.dataset.val === s.theme));
  const an = $('#setAnimations'); if (an) an.checked = !!s.animations;
  const rate = $('#setRate');
  if (rate){
    rate.value = Math.round((Number(s.playbackRate) || 1) * 100);
    rate.style.setProperty('--p', Math.round(((rate.value - 50) / 150) * 100) + '%');
  }
  const rv = $('#setRateVal'); if (rv) rv.textContent = (Number(s.playbackRate) || 1).toFixed(2) + 'x';
  const as = $('#setAutoScroll'); if (as) as.checked = !!s.autoScrollLyrics;
  const ar = $('#setAutoRetry'); if (ar) ar.checked = !!s.autoRetry;
  try {
    const all = await cacheAll();
    const total = all.reduce((sum, e) => sum + (e.size || 0), 0);
    const ci = $('#setCacheInfo');
    if (ci) ci.textContent = all.length ? `${all.length} tracks · ${fmtSize(total)}` : 'Empty';
  } catch {}
  const ri = $('#setRecentInfo');
  if (ri){ const n = ls.get(KEY.recent, []).length; ri.textContent = n ? `${n} item${n !== 1 ? 's' : ''}` : 'Empty'; }
}
$('#setTheme')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-val]'); if (!b) return;
  setSetting('theme', b.dataset.val); updateSettingsSheet();
});
$('#setAnimations')?.addEventListener('change', e => setSetting('animations', e.target.checked));
$('#setRate')?.addEventListener('input', e => {
  const v = Number(e.target.value) / 100;
  setSetting('playbackRate', v);
  e.target.style.setProperty('--p', Math.round(((e.target.value - 50) / 150) * 100) + '%');
  const rv = $('#setRateVal'); if (rv) rv.textContent = v.toFixed(2) + 'x';
  audio.playbackRate = v;
});
$('#setAutoScroll')?.addEventListener('change', e => setSetting('autoScrollLyrics', e.target.checked));
$('#setAutoRetry')?.addEventListener('change', e => setSetting('autoRetry', e.target.checked));

async function resetAppData(){
  const ok = await askConfirm('Reset all data?', 'Likes, playlists, downloads, settings and recents will be erased.', 'Reset everything');
  if (!ok) return;
  Object.values(KEY).forEach(k => ls.remove(k));
  try { await cacheClear(); } catch {}
  cachedIds.clear();
  toast('All data reset');
  sheet('#sheetSettings').hide();
  applySettings();
  go('/');
}
async function checkForUpdate(){
  try {
    if ('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.update();
      toast('App updated — refresh to apply', 'success');
    } else toast('Service worker not supported', 'warning');
  } catch { toast('Update check failed', 'danger'); }
}

/* ══════════════════════════════════════════════════════════════
   ONLINE / OFFLINE + INSTALL
   ══════════════════════════════════════════════════════════════ */
function updateOnlineBanner(){
  const b = $('#offlineBanner');
  if (!b) return;
  b.classList.toggle('on', !navigator.onLine);
}
window.addEventListener('online', updateOnlineBanner);
window.addEventListener('offline', updateOnlineBanner);

let deferredInstall = null;
function isStandalone(){
  return window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true;
}
function showInstallButton(){ if (!isStandalone()){ const b = $('#installBtn'); if (b) b.style.display = ''; } }
function hideInstallButton(){ const b = $('#installBtn'); if (b) b.style.display = 'none'; }
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  showInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  hideInstallButton();
  toast('MusicMan installed', 'success');
});
async function promptInstall(){
  if (deferredInstall){
    try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch {}
    deferredInstall = null;
    hideInstallButton();
    return;
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const body = $('#installBody');
  if (isIOS){
    body.innerHTML = `
      <div class="install-step"><div class="n">1</div><div class="t">Open this page in <b>Safari</b>.</div></div>
      <div class="install-step"><div class="n">2</div><div class="t">Tap the <b>Share</b> button <i class="bi bi-box-arrow-up"></i>.</div></div>
      <div class="install-step"><div class="n">3</div><div class="t">Tap <b>“Add to Home Screen”</b>.</div></div>
      <div class="install-step"><div class="n">4</div><div class="t">Confirm and launch MusicMan from your home screen.</div></div>`;
  } else {
    body.innerHTML = `
      <div class="install-step"><div class="n">1</div><div class="t">Open the browser menu (<i class="bi bi-three-dots-vertical"></i>).</div></div>
      <div class="install-step"><div class="n">2</div><div class="t">Choose <b>“Install app”</b> or <b>“Add to Home screen”</b>.</div></div>
      <div class="install-step"><div class="n">3</div><div class="t">Confirm to install MusicMan.</div></div>
      <p class="text-secondary mt-2" style="font-size:.76rem">If you don't see the option, make sure the page is served over HTTPS and reload once.</p>`;
  }
  sheet('#sheetInstall').show();
}
function initInstallButton(){
  if (isStandalone()) return;
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) showInstallButton();
}

/* ══════════════════════════════════════════════════════════════
   GLOBAL EVENTS
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA'){ if (e.key === 'Escape') e.target.blur(); return; }
  if (e.code === 'Space'){ e.preventDefault(); togglePlay(); return; }
  if (e.key === 'ArrowRight' && audio.duration && isFinite(audio.duration)) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
  if (e.key === 'ArrowLeft'  && audio.duration && isFinite(audio.duration)) audio.currentTime = Math.max(audio.currentTime - 5, 0);
  if (e.key === 'n' || e.key === 'N') nextTrack();
  if (e.key === 'p' || e.key === 'P') prevTrack();
  if (e.key === 's' || e.key === 'S') toggleShuffle();
  if (e.key === 'r' || e.key === 'R') cycleRepeat();
  if (e.key === 'l' || e.key === 'L') toggleLikeCurrent();
  if (e.key === 'j' || e.key === 'J'){ if ($('#full')?.classList.contains('show')) closeFullPlayer(); else openFullPlayer(); }
  if (e.key === '/'){ e.preventDefault(); $('#searchInput')?.focus(); }
  if (e.key === 'Escape' && $('#full')?.classList.contains('show')) closeFullPlayer();
});

if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SCOPE + 'sw.js', { scope: SCOPE })
      .catch(e => console.warn('[MusicMan] SW register failed:', e));
  });
}

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
(async function boot(){
  applySettings();
  updateOnlineBanner();
  initInstallButton();

  if (window.__INITIAL_DATA__ && itemId(window.__INITIAL_DATA__)) cacheItems([window.__INITIAL_DATA__]);

  DL.load();
  resumeDownloadPolling();

  DL.onChange(() => {
    updateDownloadBadges();
    syncSaveButton();
    if (isTrackRoute()){
      const id = currentPath().split('/')[2];
      const dl = DL.get(id);
      const it = getCached('track', id);
      if (it && dl) renderCrawlCard(it, null);
    }
    if (isLibraryDlRoute()) updateDlLists();
  });
  updateDownloadBadges();

  try { await refreshCacheIndex(); }
  catch (e){ console.warn('[MusicMan] cache index failed:', e); }

  if (!location.pathname || location.pathname === BASE) {
    try { history.replaceState(null, '', SCOPE); } catch {}
  }
  await route();
  refreshLikes();
  refreshFollowButtons();
})();
window.addEventListener('error', e => console.error('[MusicMan]', e.error || e.message));
</script>
</body>
</html>