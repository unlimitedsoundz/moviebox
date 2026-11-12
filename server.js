const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const root = __dirname;
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const apiKey = process.env.TMDB_API_KEY;
const port = Number(process.env.PORT || 4173);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg' };

async function tmdb(pathname, params = {}) {
  if (!apiKey) throw new Error('TMDB_API_KEY is missing from .env.local');
  const query = new URLSearchParams({ api_key: apiKey, language: 'en-US', ...params });
  const response = await fetch(`https://api.themoviedb.org/3${pathname}?${query}`);
  if (!response.ok) throw new Error(`TMDB request failed (${response.status})`);
  return response.json();
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/status') return send(res, 200, { connected: Boolean(apiKey), provider: 'TMDB' });
    if (url.pathname === '/api/catalog') {
      const search = url.searchParams.get('query')?.trim();
      const mediaType = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const page = Math.max(1, Math.min(500, Number(url.searchParams.get('page')) || 1));
      const genre = url.searchParams.get('genre') || '';
      const year = url.searchParams.get('year') || '';
      const sort = url.searchParams.get('sort') || 'featured';
      const region = (url.searchParams.get('region') || 'NG').toUpperCase();
      const availability = url.searchParams.get('availability') || 'all';
      const genres = await tmdb(`/genre/${mediaType}/list`);
      const genreNames = Object.fromEntries((genres.genres || []).map(g => [g.id, g.name]));
      let endpoint = `/${mediaType}/popular`;
      const params = { page: String(page) };
      if (search) {
        endpoint = `/search/${mediaType}`;
        params.query = search;
        params.include_adult = 'false';
      } else if (genre || year || availability !== 'all' || ['rating','newest','az'].includes(sort)) {
        endpoint = `/discover/${mediaType}`;
        params.watch_region = region;
        if (availability !== 'all') params.with_watch_monetization_types = availability;
        if (genre) {
          const match = (genres.genres || []).find(g => g.name.toLowerCase() === genre.toLowerCase());
          if (match) params.with_genres = String(match.id);
        }
        if (/^\d{4}$/.test(year)) params[mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = year;
        if (sort === 'rating') { params.sort_by = 'vote_average.desc'; params['vote_count.gte'] = '100'; }
        else if (sort === 'newest') params.sort_by = mediaType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
        else if (sort === 'az') params.sort_by = mediaType === 'tv' ? 'original_name.asc' : 'original_title.asc';
        else params.sort_by = 'popularity.desc';
      }
      const resultPage = await tmdb(endpoint, params);
      let sourceResults = resultPage.results || [];
      if (search && availability !== 'all' && sourceResults.length) {
        sourceResults = await Promise.all(sourceResults.map(async item => {
          try {
            const providerData = await tmdb(`/${mediaType}/${item.id}/watch/providers`);
            const regionData = providerData.results?.[region];
            const allowed = availability.split('|').some(group => regionData?.[group]?.length);
            return allowed ? item : null;
          } catch { return null; }
        }));
        sourceResults = sourceResults.filter(Boolean);
      }
      const results = sourceResults.map(m => ({
        id: `tmdb-${mediaType}-${m.id}`, tmdbId: m.id, mediaType,
        title: m.title || m.name || m.original_title || m.original_name || 'Untitled',
        year: Number((m.release_date || m.first_air_date || '').slice(0, 4)) || 0,
        genre: (m.genre_ids || []).map(id => genreNames[id]).filter(Boolean).join(', ') || 'Movie',
        genres: (m.genre_ids || []).map(id => genreNames[id]).filter(Boolean),
        rating: Number(m.vote_average) || 0,
        duration: '',
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
        backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : '',
        description: m.overview || 'No synopsis is available.',
        videoUrl: '', source: 'TMDB', voteCount: m.vote_count || 0,
        originalLanguage: m.original_language || ''
      }));
      return send(res, 200, { results, page: resultPage.page || page, totalPages: resultPage.total_pages || 1, total: resultPage.total_results || results.length });
    }
    const detailMatch = url.pathname.match(/^\/api\/title\/(movie|tv)\/(\d+)$/);
    if (detailMatch) {
      const title = await tmdb(`/${detailMatch[1]}/${detailMatch[2]}`, { append_to_response: detailMatch[1] === 'tv' ? 'aggregate_credits,videos' : 'credits,videos' });
      return send(res, 200, title);
    }
    const providersMatch = url.pathname.match(/^\/api\/providers\/(movie|tv)\/(\d+)$/);
    if (providersMatch) {
      const region = (url.searchParams.get('region') || 'NG').toUpperCase();
      const data = await tmdb(`/${providersMatch[1]}/${providersMatch[2]}/watch/providers`);
      return send(res, 200, { region, ...(data.results?.[region] || {}) });
    }
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root + path.sep)) return send(res, 403, { error: 'Forbidden' });
    fs.readFile(filePath, (error, data) => {
      if (error) return send(res, 404, { error: 'Not found' });
      send(res, 200, data, mime[path.extname(filePath)] || 'application/octet-stream');
    });
  } catch (error) {
    send(res, 502, { error: error.message || 'Request failed' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MovieBox is running at http://127.0.0.1:${port}`);
  if (!apiKey) console.log('Add TMDB_API_KEY to .env.local to connect the catalog.');
});
