const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  try {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}

const logoCache = new Map();
const ageRatingCache = new Map();
const RATING_REGION_PRIORITY = ['US', 'GB', 'CA', 'AU', 'NG', 'DE', 'FR'];

function extractMovieCert(releaseDates) {
  const list = Array.isArray(releaseDates?.results) ? releaseDates.results : [];
  const pickFromCountry = entry => {
    const rels = Array.isArray(entry?.release_dates) ? entry.release_dates : [];
    const hit = rels.find(r => r && r.certification && String(r.certification).trim());
    return hit ? String(hit.certification).trim() : '';
  };
  for (const code of RATING_REGION_PRIORITY) {
    const entry = list.find(r => r && r.iso_3166_1 === code);
    const cert = pickFromCountry(entry);
    if (cert) return cert;
  }
  for (const entry of list) {
    const cert = pickFromCountry(entry);
    if (cert) return cert;
  }
  return '';
}

function extractTvRating(contentRatings) {
  const list = Array.isArray(contentRatings?.results) ? contentRatings.results : [];
  for (const code of RATING_REGION_PRIORITY) {
    const entry = list.find(r => r && r.iso_3166_1 === code && r.rating && String(r.rating).trim());
    if (entry) return String(entry.rating).trim();
  }
  const any = list.find(r => r && r.rating && String(r.rating).trim());
  return any ? String(any.rating).trim() : '';
}

async function fetchAgeRating(apiKey, itemType, tmdbId) {
  const key = `${itemType}-${tmdbId}`;
  if (ageRatingCache.has(key)) return ageRatingCache.get(key);
  try {
    const endpoint = itemType === 'tv' ? `/tv/${tmdbId}/content_ratings` : `/movie/${tmdbId}/release_dates`;
    const data = await tmdb(apiKey, endpoint, { language: '' });
    const rating = itemType === 'tv' ? extractTvRating(data) : extractMovieCert(data);
    ageRatingCache.set(key, rating || '');
    return rating || '';
  } catch {
    return '';
  }
}

async function fetchBestLogo(apiKey, itemType, tmdbId) {
  const key = `${itemType}-${tmdbId}`;
  if (logoCache.has(key)) return logoCache.get(key);
  try {
    const data = await tmdb(apiKey, `/${itemType}/${tmdbId}/images`, {
      include_image_language: 'en,null'
    });
    const logos = Array.isArray(data?.logos) ? data.logos : [];
    const usable = logos.filter(l => l && l.file_path && /\.(png|svg)$/i.test(l.file_path));
    const pool = usable.length ? usable : logos.filter(l => l && l.file_path);
    if (!pool.length) {
      logoCache.set(key, '');
      return '';
    }
    pool.sort((a, b) => {
      const aEn = a.iso_639_1 === 'en' ? 1 : 0;
      const bEn = b.iso_639_1 === 'en' ? 1 : 0;
      if (aEn !== bEn) return bEn - aEn;
      const aPng = /\.png$/i.test(a.file_path) ? 1 : 0;
      const bPng = /\.png$/i.test(b.file_path) ? 1 : 0;
      if (aPng !== bPng) return bPng - aPng;
      const aWide = (a.aspect_ratio || 1) >= 1.2 ? 1 : 0;
      const bWide = (b.aspect_ratio || 1) >= 1.2 ? 1 : 0;
      if (aWide !== bWide) return bWide - aWide;
      return (b.vote_count || 0) - (a.vote_count || 0) || (b.vote_average || 0) - (a.vote_average || 0);
    });
    const bestUrl = `https://image.tmdb.org/t/p/w500${pool[0].file_path}`;
    logoCache.set(key, bestUrl);
    return bestUrl;
  } catch {
    return '';
  }
}

function mapTmdbItem(m, itemType, genreNames) {
  const cachedLogo = logoCache.get(`${itemType}-${m.id}`) || '';
  const cachedAgeRating = ageRatingCache.get(`${itemType}-${m.id}`) || '';
  return {
    id: `tmdb-${itemType}-${m.id}`,
    tmdbId: m.id,
    mediaType: itemType,
    title: m.title || m.name || m.original_title || m.original_name || 'Untitled',
    year: Number((m.release_date || m.first_air_date || '').slice(0, 4)) || 0,
    releaseDate: m.release_date || m.first_air_date || '',
    genre: (m.genre_ids || []).map(id => genreNames[id]).filter(Boolean).join(', ') || (itemType === 'tv' ? 'TV Series' : 'Movie'),
    genres: (m.genre_ids || []).map(id => genreNames[id]).filter(Boolean),
    rating: Number(m.vote_average) || 0,
    ageRating: cachedAgeRating,
    duration: '',
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
    backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : '',
    logo: cachedLogo,
    description: m.overview || 'No synopsis is available.',
    videoUrl: '',
    source: 'TMDB',
    voteCount: m.vote_count || 0,
    originalLanguage: m.original_language || ''
  };
}

function interleaveUnique(movieList, tvList) {
  const combined = [];
  const seen = new Set();
  const maxLen = Math.max(movieList.length, tvList.length);
  for (let i = 0; i < maxLen; i++) {
    for (const candidate of [movieList[i], tvList[i]]) {
      if (!candidate || !candidate.id) continue;
      const key = `${candidate._mediaType}-${candidate.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(candidate);
    }
  }
  return combined;
}

async function fetchRecent24h(apiKey, genreNames, region = 'US') {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [primaryMovies, regionalMovies, newTv, airingTodayTv, airDateTv] = await Promise.all([
    tmdb(apiKey, '/discover/movie', {
      'primary_release_date.gte': yesterdayStr,
      'primary_release_date.lte': todayStr,
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: '1'
    }).catch(() => ({ results: [] })),
    tmdb(apiKey, '/discover/movie', {
      'release_date.gte': yesterdayStr,
      'release_date.lte': todayStr,
      region,
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: '1'
    }).catch(() => ({ results: [] })),
    tmdb(apiKey, '/discover/tv', {
      'first_air_date.gte': yesterdayStr,
      'first_air_date.lte': todayStr,
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: '1'
    }).catch(() => ({ results: [] })),
    tmdb(apiKey, '/tv/airing_today', { page: '1' }).catch(() => ({ results: [] })),
    tmdb(apiKey, '/discover/tv', {
      'air_date.gte': yesterdayStr,
      'air_date.lte': todayStr,
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: '1'
    }).catch(() => ({ results: [] }))
  ]);

  const withPosterFirst = list => [
    ...list.filter(item => item && item.poster_path),
    ...list.filter(item => item && !item.poster_path)
  ];

  const movieList = withPosterFirst([
    ...(primaryMovies.results || []),
    ...(regionalMovies.results || [])
  ]).map(m => ({ ...m, _mediaType: 'movie' }));

  const tvList = withPosterFirst([
    ...(newTv.results || []),
    ...(airingTodayTv.results || []),
    ...(airDateTv.results || [])
  ]).map(m => ({ ...m, _mediaType: 'tv' }));

  return interleaveUnique(movieList, tvList)
    .slice(0, 20)
    .map(m => ({ ...mapTmdbItem(m, m._mediaType, genreNames), isRecent24h: true }));
}

async function tmdb(apiKey, pathname, params = {}) {
  if (!apiKey) throw new Error('TMDB_API_KEY is missing');
  const cleanKey = apiKey.trim();
  const headers = { 'Accept': 'application/json' };
  const queryParams = { language: 'en-US', ...params };
  if (queryParams.language === '') delete queryParams.language;

  if (cleanKey.startsWith('eyJ') || cleanKey.length > 50) {
    headers['Authorization'] = `Bearer ${cleanKey}`;
  } else {
    queryParams.api_key = cleanKey;
  }

  const query = new URLSearchParams(queryParams);
  const response = await fetch(`https://api.themoviedb.org/3${pathname}?${query}`, { headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`TMDB error (${response.status}) on ${pathname}:`, errorText);
    throw new Error(`TMDB request failed (${response.status})`);
  }
  return response.json();
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  if (res.headersSent) return;
  const isJson = contentType.startsWith('application/json');

  if (typeof res.status === 'function') {
    if (isJson && typeof res.json === 'function') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(status).json(body);
    }
    if (typeof res.send === 'function') {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(status).send(isJson ? JSON.stringify(body) : body);
    }
  }

  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(payload);
}

function getRoute(req, url) {
  // 1. Original incoming request URL as sent by client (Vercel sets x-vercel-original-url)
  const orig = req.headers['x-vercel-original-url'] || req.headers['x-forwarded-uri'] || req.headers['x-original-url'];
  if (orig && orig.startsWith('/api/')) {
    return orig.split('?')[0];
  }

  // 2. Explicit endpoint query parameter if rewritten
  const endpoint = url.searchParams.get('__endpoint') || url.searchParams.get('_path');
  if (endpoint) {
    return `/api/${endpoint.replace(/^\/+/, '')}`;
  }

  // 3. Vercel dynamic route slug handling: api/title/[...slug] or api/providers/[...slug]
  if (req.query?.slug) {
    const slugArr = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug];
    const rawPath = url.pathname || '';
    const matched = req.headers['x-matched-path'] || '';
    if (rawPath.includes('/title') || matched.includes('/title')) {
      return `/api/title/${slugArr.join('/')}`;
    }
    if (rawPath.includes('/providers') || matched.includes('/providers')) {
      return `/api/providers/${slugArr.join('/')}`;
    }
  }

  // 4. x-matched-path only if it doesn't contain bracket patterns like [...slug]
  const matched = req.headers['x-matched-path'];
  if (matched && matched.startsWith('/api/') && !matched.includes('[')) {
    return matched.split('?')[0];
  }

  return url.pathname;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost'}`);
  const rawKey = process.env.TMDB_API_KEY || '';
  const apiKey = rawKey.replace(/^['"]|['"]$/g, '').trim();
  const routePath = getRoute(req, url);

  try {
    if (routePath === '/api/status') {
      return send(res, 200, {
        connected: Boolean(apiKey),
        keyLength: apiKey ? apiKey.length : 0,
        keyType: apiKey.startsWith('eyJ') ? 'v4 Bearer Token' : 'v3 API Key',
        provider: 'TMDB'
      });
    }

    if (routePath === '/api/logos') {
      if (!apiKey) return send(res, 200, { logos: {} });
      const rawItems = (url.searchParams.get('items') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
      const logos = {};
      await Promise.all(rawItems.map(async entry => {
        const match = entry.match(/^(movie|tv):(\d+)$/);
        if (!match) return;
        const [, t, id] = match;
        const logoUrl = await fetchBestLogo(apiKey, t, id);
        if (logoUrl) logos[`tmdb-${t}-${id}`] = logoUrl;
      }));
      return send(res, 200, { logos });
    }

    if (routePath === '/api/catalog') {
      if (!apiKey) {
        return send(res, 200, {
          results: [],
          page: 1,
          totalPages: 1,
          total: 0,
          connected: false,
          error: 'TMDB_API_KEY not found in environment. Please add TMDB_API_KEY in Vercel and Redeploy.'
        });
      }

      const search = url.searchParams.get('query')?.trim();
      const rawType = url.searchParams.get('type');
      const mediaType = rawType === 'tv' ? 'tv' : rawType === 'all' ? 'all' : 'movie';
      const page = Math.max(1, Math.min(500, Number(url.searchParams.get('page')) || 1));
      const rawGenre = url.searchParams.get('genre') || '';
      const genre = rawGenre.toLowerCase() === 'all' ? '' : rawGenre;
      const rawYear = url.searchParams.get('year') || '';
      const year = rawYear.toLowerCase() === 'all' ? '' : rawYear;
      const sort = url.searchParams.get('sort') || 'featured';
      const region = (url.searchParams.get('region') || 'US').toUpperCase();
      const availability = url.searchParams.get('availability') || 'all';
      const recent = url.searchParams.get('recent') || '';

      const [movieGenresRes, tvGenresRes] = await Promise.all([
        tmdb(apiKey, '/genre/movie/list').catch(() => ({ genres: [] })),
        tmdb(apiKey, '/genre/tv/list').catch(() => ({ genres: [] }))
      ]);
      const genreNames = {
        ...Object.fromEntries((movieGenresRes.genres || []).map(g => [g.id, g.name])),
        ...Object.fromEntries((tvGenresRes.genres || []).map(g => [g.id, g.name]))
      };

      if (recent === '24h') {
        const recentResults = await fetchRecent24h(apiKey, genreNames, region);
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 200, {
          results: recentResults,
          recentResults,
          page: 1,
          totalPages: 1,
          total: recentResults.length
        });
      }

      let sourceResults = [];
      let recentResults = [];
      let homeShelves = null;
      let totalPages = 1;
      let totalResults = 0;
      let currentPageNum = page;

      const mapUnique = (list, type, limit = 18) => {
        const seen = new Set();
        const out = [];
        for (const item of list || []) {
          if (!item || !item.id) continue;
          const t = item._mediaType || type;
          const k = `${t}-${item.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(mapTmdbItem(item, t, genreNames));
          if (out.length >= limit) break;
        }
        return out;
      };

      const isCuratedPage = !search && !genre && !year && availability === 'all' && sort === 'featured';

      if (mediaType === 'all' && isCuratedPage) {
        const [
          trendMovies,
          trendTv,
          nowPlaying,
          onAir,
          recent24h,
          topRatedTv,
          topRatedMovies,
          adrenalineMoviesRes,
          crimeDramaTvRes,
          thrillerMoviesRes
        ] = await Promise.all([
          tmdb(apiKey, '/trending/movie/day', { page: String(page) }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/trending/tv/day', { page: String(page) }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/movie/now_playing', { page: String(page), region }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/tv/on_the_air', { page: String(page) }).catch(() => ({ results: [] })),
          page === 1 ? fetchRecent24h(apiKey, genreNames, region).catch(() => []) : Promise.resolve([]),
          page === 1 ? tmdb(apiKey, '/tv/top_rated', { page: '1' }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
          page === 1 ? tmdb(apiKey, '/movie/top_rated', { page: '1' }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
          page === 1 ? tmdb(apiKey, '/discover/movie', { with_genres: '28,12', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
          page === 1 ? tmdb(apiKey, '/discover/tv', { with_genres: '80,9648,18', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
          page === 1 ? tmdb(apiKey, '/discover/movie', { with_genres: '53,80,9648', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] })
        ]);
        const movieList = [...(trendMovies.results || []), ...(nowPlaying.results || [])].map(m => ({ ...m, _mediaType: 'movie' }));
        const tvList = [...(trendTv.results || []), ...(onAir.results || [])].map(m => ({ ...m, _mediaType: 'tv' }));
        sourceResults = interleaveUnique(movieList, tvList);
        recentResults = recent24h;
        totalPages = Math.max(trendMovies.total_pages || 1, trendTv.total_pages || 1);
        totalResults = (trendMovies.total_results || 0) + (trendTv.total_results || 0);

        if (page === 1) {
          const top10Series = mapUnique(trendTv.results || onAir.results || [], 'tv', 10);
          const top10Films = mapUnique(trendMovies.results || nowPlaying.results || [], 'movie', 10);
          const topPicks = mapUnique(interleaveUnique(
            (trendMovies.results || []).slice(2).map(m => ({ ...m, _mediaType: 'movie' })),
            (trendTv.results || []).slice(2).map(m => ({ ...m, _mediaType: 'tv' }))
          ), 'movie', 18);
          const bingeworthyTv = mapUnique([...(onAir.results || []), ...(topRatedTv.results || [])], 'tv', 18);
          const adrenalineMovies = mapUnique(adrenalineMoviesRes.results || [], 'movie', 18);
          const ominousDrama = mapUnique(crimeDramaTvRes.results || [], 'tv', 18);
          const newReleases = recent24h.length
            ? recent24h.slice(0, 18)
            : mapUnique(interleaveUnique(
                (nowPlaying.results || []).map(m => ({ ...m, _mediaType: 'movie' })),
                (onAir.results || []).map(m => ({ ...m, _mediaType: 'tv' }))
              ), 'movie', 18);
          const rewatchFavorites = mapUnique(interleaveUnique(
            (topRatedMovies.results || []).map(m => ({ ...m, _mediaType: 'movie' })),
            (topRatedTv.results || []).map(m => ({ ...m, _mediaType: 'tv' }))
          ), 'movie', 18);
          const crimeMystery = mapUnique(thrillerMoviesRes.results || [], 'movie', 18);

          homeShelves = {
            mode: 'all',
            topPicks,
            top10Series,
            bingeworthyTv,
            top10Films,
            adrenalineMovies,
            ominousDrama,
            newReleases,
            rewatchFavorites,
            crimeMystery
          };
        }
      } else if (mediaType === 'tv' && isCuratedPage && page === 1) {
        const [
          trendTv,
          onAir,
          topRatedTv,
          crimeDramaTv,
          sciFiTv,
          comedyTv,
          actionTv
        ] = await Promise.all([
          tmdb(apiKey, '/trending/tv/day', { page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/tv/on_the_air', { page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/tv/top_rated', { page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/tv', { with_genres: '80,9648', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/tv', { with_genres: '10765', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/tv', { with_genres: '35', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/tv', { with_genres: '10759', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] }))
        ]);
        const tvList = [...(trendTv.results || []), ...(onAir.results || [])].map(m => ({ ...m, _mediaType: 'tv' }));
        sourceResults = tvList;
        totalPages = trendTv.total_pages || 1;
        totalResults = trendTv.total_results || tvList.length;
        homeShelves = {
          mode: 'tv',
          topPicks: mapUnique([...(trendTv.results || []).slice(2), ...(onAir.results || [])], 'tv', 18),
          top10Series: mapUnique(trendTv.results || onAir.results || [], 'tv', 10),
          bingeworthyTv: mapUnique(onAir.results || [], 'tv', 18),
          ominousDrama: mapUnique(crimeDramaTv.results || [], 'tv', 18),
          sciFiFantasy: mapUnique(sciFiTv.results || [], 'tv', 18),
          actionAdventure: mapUnique(actionTv.results || [], 'tv', 18),
          comedy: mapUnique(comedyTv.results || [], 'tv', 18),
          rewatchFavorites: mapUnique(topRatedTv.results || [], 'tv', 18)
        };
      } else if (mediaType === 'movie' && isCuratedPage && page === 1) {
        const [
          trendMovies,
          nowPlaying,
          topRatedMovies,
          adrenalineMoviesRes,
          thrillerMoviesRes,
          sciFiMoviesRes,
          comedyMoviesRes
        ] = await Promise.all([
          tmdb(apiKey, '/trending/movie/day', { page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/movie/now_playing', { page: '1', region }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/movie/top_rated', { page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/movie', { with_genres: '28,12', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/movie', { with_genres: '53,80,9648', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/movie', { with_genres: '878,14', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/discover/movie', { with_genres: '35', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }).catch(() => ({ results: [] }))
        ]);
        const movieList = [...(trendMovies.results || []), ...(nowPlaying.results || [])].map(m => ({ ...m, _mediaType: 'movie' }));
        sourceResults = movieList;
        totalPages = trendMovies.total_pages || 1;
        totalResults = trendMovies.total_results || movieList.length;
        homeShelves = {
          mode: 'movie',
          topPicks: mapUnique([...(trendMovies.results || []).slice(2), ...(nowPlaying.results || [])], 'movie', 18),
          top10Films: mapUnique(trendMovies.results || nowPlaying.results || [], 'movie', 10),
          newReleases: mapUnique(nowPlaying.results || [], 'movie', 18),
          adrenalineMovies: mapUnique(adrenalineMoviesRes.results || [], 'movie', 18),
          crimeMystery: mapUnique(thrillerMoviesRes.results || [], 'movie', 18),
          sciFiFantasy: mapUnique(sciFiMoviesRes.results || [], 'movie', 18),
          comedy: mapUnique(comedyMoviesRes.results || [], 'movie', 18),
          rewatchFavorites: mapUnique(topRatedMovies.results || [], 'movie', 18)
        };
      } else {
        const effectiveType = mediaType === 'all' ? 'movie' : mediaType;
        let endpoint = `/trending/${effectiveType}/day`;
        const params = { page: String(page) };

        if (search) {
          endpoint = '/search/multi';
          params.query = search;
          params.include_adult = 'false';
        } else if (genre || year || availability !== 'all' || ['rating', 'newest', 'az'].includes(sort)) {
          endpoint = `/discover/${effectiveType}`;
          params.watch_region = region;
          if (availability !== 'all') params.with_watch_monetization_types = availability;
          if (genre) {
            const activeGenresList = effectiveType === 'tv' ? (tvGenresRes.genres || []) : (movieGenresRes.genres || []);
            const match = activeGenresList.find(g => g.name.toLowerCase() === genre.toLowerCase());
            if (match) params.with_genres = String(match.id);
          }
          if (/^\d{4}$/.test(year)) params[effectiveType === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = year;
          if (sort === 'rating') { params.sort_by = 'vote_average.desc'; params['vote_count.gte'] = '100'; }
          else if (sort === 'newest') {
            params.sort_by = effectiveType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
            const today = new Date().toISOString().slice(0, 10);
            if (effectiveType === 'tv') {
              params['first_air_date.lte'] = today;
            } else {
              params['primary_release_date.lte'] = today;
            }
            params['vote_count.gte'] = '5';
          }
          else if (sort === 'az') params.sort_by = effectiveType === 'tv' ? 'original_name.asc' : 'original_title.asc';
          else params.sort_by = 'popularity.desc';
        }

        const resultPage = await tmdb(apiKey, endpoint, params);
        sourceResults = (resultPage.results || []).filter(item => {
          if (search) {
            return item.media_type === 'movie' || item.media_type === 'tv' || (!item.media_type && (item.title || item.name));
          }
          return true;
        });
        if (search && availability !== 'all' && sourceResults.length) {
          sourceResults = await Promise.all(sourceResults.map(async item => {
            try {
              const itemType = item.media_type === 'tv' ? 'tv' : 'movie';
              const providerData = await tmdb(apiKey, `/${itemType}/${item.id}/watch/providers`);
              const regionData = providerData.results?.[region];
              const allowed = availability.split('|').some(group => regionData?.[group]?.length);
              return allowed ? item : null;
            } catch { return null; }
          }));
          sourceResults = sourceResults.filter(Boolean);
        }
        currentPageNum = resultPage.page || page;
        totalPages = resultPage.total_pages || 1;
        totalResults = resultPage.total_results || sourceResults.length;
      }

      const results = sourceResults.map(m => {
        const itemType = m._mediaType || (search ? (m.media_type === 'tv' ? 'tv' : 'movie') : (mediaType === 'all' ? 'movie' : mediaType));
        return mapTmdbItem(m, itemType, genreNames);
      });

      if (page === 1 && !search && results.length) {
        const heroCandidates = results.filter(m => m.backdrop).slice(0, 5);
        await Promise.all(heroCandidates.map(async item => {
          if (!item.tmdbId) return;
          const t = item.mediaType === 'tv' ? 'tv' : 'movie';
          const [logo, ageRating] = await Promise.all([
            item.logo ? Promise.resolve(item.logo) : fetchBestLogo(apiKey, t, item.tmdbId),
            item.ageRating ? Promise.resolve(item.ageRating) : fetchAgeRating(apiKey, t, item.tmdbId)
          ]);
          if (logo) item.logo = logo;
          if (ageRating) item.ageRating = ageRating;
        }));
      }

      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, {
        results,
        recentResults,
        homeShelves,
        page: currentPageNum,
        totalPages,
        total: totalResults || results.length
      });
    }

    const seasonMatch = routePath.match(/^\/api\/title\/tv\/(\d+)\/season\/(\d+)$/);
    if (seasonMatch) {
      if (!apiKey) return send(res, 404, { error: 'TMDB_API_KEY missing' });
      const seasonData = await tmdb(apiKey, `/tv/${seasonMatch[1]}/season/${seasonMatch[2]}`);
      return send(res, 200, seasonData);
    }

    let detailType = '', detailId = '', detailSeason = url.searchParams.get('season') || '';
    const detailMatch = routePath.match(/^\/api\/title\/(movie|tv)\/(\d+)$/);
    if (detailMatch) {
      detailType = detailMatch[1];
      detailId = detailMatch[2];
    } else if (routePath.startsWith('/api/title')) {
      detailType = url.searchParams.get('type') || url.searchParams.get('mediaType') || (routePath.includes('/tv') ? 'tv' : routePath.includes('/movie') ? 'movie' : '');
      const idMatch = routePath.match(/\/(\d+)(?:\/|$|\?)/);
      detailId = url.searchParams.get('id') || url.searchParams.get('tmdbId') || (idMatch ? idMatch[1] : '');
    }

    if (detailType && detailId) {
      if (!apiKey) return send(res, 404, { error: 'TMDB_API_KEY missing' });
      if (detailType === 'tv' && /^\d+$/.test(detailSeason)) {
        const seasonData = await tmdb(apiKey, `/tv/${detailId}/season/${detailSeason}`);
        return send(res, 200, seasonData);
      }
      const title = await tmdb(apiKey, `/${detailType}/${detailId}`, {
        append_to_response: detailType === 'tv' ? 'aggregate_credits,videos,content_ratings' : 'credits,videos,release_dates',
        include_video_language: 'en,null'
      });
      const extractedRating = detailType === 'tv'
        ? extractTvRating(title?.content_ratings)
        : extractMovieCert(title?.release_dates);
      if (extractedRating) {
        ageRatingCache.set(`${detailType}-${detailId}`, extractedRating);
        title.ageRating = extractedRating;
      } else {
        title.ageRating = ageRatingCache.get(`${detailType}-${detailId}`) || '';
      }
      const existingYt = (title?.videos?.results || []).filter(v => v && v.site === 'YouTube' && v.key);
      if (existingYt.length < 3) {
        const allVideos = await tmdb(apiKey, `/${detailType}/${detailId}/videos`, { language: '' }).catch(() => null);
        if (Array.isArray(allVideos?.results) && allVideos.results.length) {
          const seenKeys = new Set(existingYt.map(v => v.key));
          const merged = [...existingYt];
          for (const v of allVideos.results) {
            if (v && v.site === 'YouTube' && v.key && !seenKeys.has(v.key)) {
              seenKeys.add(v.key);
              merged.push(v);
            }
          }
          title.videos = { results: merged };
        }
      }
      return send(res, 200, title);
    }

    let providerType = '', providerId = '';
    const providersMatch = routePath.match(/^\/api\/providers\/(movie|tv)\/(\d+)$/);
    if (providersMatch) {
      providerType = providersMatch[1];
      providerId = providersMatch[2];
    } else if (routePath.startsWith('/api/providers')) {
      providerType = url.searchParams.get('type') || url.searchParams.get('mediaType') || (routePath.includes('/tv') ? 'tv' : routePath.includes('/movie') ? 'movie' : '');
      const idMatch = routePath.match(/\/(\d+)(?:\/|$|\?)/);
      providerId = url.searchParams.get('id') || url.searchParams.get('tmdbId') || (idMatch ? idMatch[1] : '');
    }

    if (providerType && providerId) {
      if (!apiKey) return send(res, 200, { region: 'US', free: [], ads: [] });
      const region = (url.searchParams.get('region') || 'US').toUpperCase();
      const data = await tmdb(apiKey, `/${providerType}/${providerId}/watch/providers`);
      return send(res, 200, { region, ...(data.results?.[region] || {}) });
    }

    send(res, 404, { error: 'Not found', path: routePath });
  } catch (error) {
    console.error('API Error:', error);
    send(res, 502, { error: error.message || 'Request failed' });
  }
};
