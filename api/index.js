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

async function tmdb(apiKey, pathname, params = {}) {
  if (!apiKey) throw new Error('TMDB_API_KEY is missing');
  const cleanKey = apiKey.trim();
  const headers = { 'Accept': 'application/json' };
  const queryParams = { language: 'en-US', ...params };

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
      const genre = url.searchParams.get('genre') || '';
      const year = url.searchParams.get('year') || '';
      const sort = url.searchParams.get('sort') || 'featured';
      const region = (url.searchParams.get('region') || 'US').toUpperCase();
      const availability = url.searchParams.get('availability') || 'all';

      const [movieGenresRes, tvGenresRes] = await Promise.all([
        tmdb(apiKey, '/genre/movie/list').catch(() => ({ genres: [] })),
        tmdb(apiKey, '/genre/tv/list').catch(() => ({ genres: [] }))
      ]);
      const genreNames = {
        ...Object.fromEntries((movieGenresRes.genres || []).map(g => [g.id, g.name])),
        ...Object.fromEntries((tvGenresRes.genres || []).map(g => [g.id, g.name]))
      };

      let sourceResults = [];
      let totalPages = 1;
      let totalResults = 0;
      let currentPageNum = page;

      if (mediaType === 'all' && !search && !genre && !year && availability === 'all' && sort === 'featured') {
        const [trendMovies, trendTv, nowPlaying, onAir] = await Promise.all([
          tmdb(apiKey, '/trending/movie/day', { page: String(page) }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/trending/tv/day', { page: String(page) }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/movie/now_playing', { page: String(page), region }).catch(() => ({ results: [] })),
          tmdb(apiKey, '/tv/on_the_air', { page: String(page) }).catch(() => ({ results: [] }))
        ]);
        const movieList = [...(nowPlaying.results || []), ...(trendMovies.results || [])].map(m => ({ ...m, _mediaType: 'movie' }));
        const tvList = [...(onAir.results || []), ...(trendTv.results || [])].map(m => ({ ...m, _mediaType: 'tv' }));
        const seen = new Set();
        const maxLen = Math.max(movieList.length, tvList.length);
        for (let i = 0; i < maxLen; i++) {
          for (const candidate of [movieList[i], tvList[i]]) {
            if (!candidate || !candidate.id) continue;
            const key = `${candidate._mediaType}-${candidate.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            sourceResults.push(candidate);
          }
        }
        totalPages = Math.max(trendMovies.total_pages || 1, trendTv.total_pages || 1);
        totalResults = (trendMovies.total_results || 0) + (trendTv.total_results || 0);
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
        return {
          id: `tmdb-${itemType}-${m.id}`,
          tmdbId: m.id,
          mediaType: itemType,
          title: m.title || m.name || m.original_title || m.original_name || 'Untitled',
          year: Number((m.release_date || m.first_air_date || '').slice(0, 4)) || 0,
          genre: (m.genre_ids || []).map(id => genreNames[id]).filter(Boolean).join(', ') || (itemType === 'tv' ? 'TV Series' : 'Movie'),
          genres: (m.genre_ids || []).map(id => genreNames[id]).filter(Boolean),
          rating: Number(m.vote_average) || 0,
          duration: '',
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
          backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : '',
          description: m.overview || 'No synopsis is available.',
          videoUrl: '',
          source: 'TMDB',
          voteCount: m.vote_count || 0,
          originalLanguage: m.original_language || ''
        };
      });

      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, {
        results,
        page: currentPageNum,
        totalPages,
        total: totalResults || results.length
      });
    }

    let detailType = '', detailId = '';
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
      const title = await tmdb(apiKey, `/${detailType}/${detailId}`, {
        append_to_response: detailType === 'tv' ? 'aggregate_credits,videos' : 'credits,videos'
      });
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
