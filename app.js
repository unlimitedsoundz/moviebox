const DEMO_1080P = 'https://archive.org/download/Sintel/sintel-2048-stereo.mp4';
const DEMO_720P = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.720p.vp9.webm';
const DEMO_480P = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
const DEMO_QUALITIES = { '1080': DEMO_1080P, '720': DEMO_720P, '480': DEMO_480P };
const DEMO_VIDEO = DEMO_1080P;
const art = (id, w=650) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=82`;
const movies = [
 {id:'horizon',title:'The Last Horizon',year:2025,genre:'Adventure',rating:8.7,duration:'2h 08m',tag:'MOVIEBOX ORIGINAL',poster:art('photo-1470770841072-f978cf4d019e'),description:'At the edge of a changing world, one quiet journey becomes the story that brings everyone home.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES,subtitlesUrl:null,featured:true},
 {id:'blue',title:'Blue Hour',year:2024,genre:'Drama',rating:8.3,duration:'1h 54m',poster:art('photo-1470252649378-9c29740c9fa8'),description:'Two old friends reunite for one last summer beside the sea.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'wild',title:'Wild & Open',year:2025,genre:'Documentary',rating:9.1,duration:'1h 31m',poster:art('photo-1464822759023-fed622ff2c3b'),description:'A breathtaking journey into the world’s last untouched wilderness.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'orbit',title:'Orbit 9',year:2023,genre:'Science fiction',rating:7.9,duration:'2h 02m',poster:art('photo-1446776811953-b23d57bd21aa'),description:'The first crew to reach the outer planets discovers a message waiting for them.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'gold',title:'Golden State',year:2024,genre:'Drama',rating:8.1,duration:'1h 47m',poster:art('photo-1500530855697-b586d89ba3ee'),description:'A daughter returns to her hometown to reopen the family’s old cinema.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'still',title:'Stillwater',year:2022,genre:'Thriller',rating:7.7,duration:'1h 49m',poster:art('photo-1501785888041-af3ef285b470'),description:'A lakeside retreat takes an unexpected turn when a storm rolls in.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'little',title:'A Little Further',year:2025,genre:'Adventure',rating:8.5,duration:'1h 58m',poster:art('photo-1500534623283-312aade485b7'),description:'A curious cartographer sets out to find the place her grandfather drew from memory.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'night',title:'Night Signals',year:2023,genre:'Science fiction',rating:8.0,duration:'1h 52m',poster:art('photo-1519608487953-e999c86e7455'),description:'One late-night radio host receives a call from somewhere far beyond the stars.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'slow',title:'The Slow Road',year:2021,genre:'Comedy',rating:7.8,duration:'1h 43m',poster:art('photo-1469854523086-cc02fe5d8800'),description:'A mismatched pair takes the scenic route and finds exactly what they needed.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES},
 {id:'between',title:'Between Tides',year:2024,genre:'Documentary',rating:8.6,duration:'1h 26m',poster:art('photo-1518837695005-2083093ee35b'),description:'Meet the people and wildlife shaped by the rhythm of the ocean.',videoUrl:DEMO_1080P,qualityUrls:DEMO_QUALITIES}
];
let catalog=[...movies], activeMovie=movies[0], toastTimer,currentPage=1,totalPages=1,totalResults=movies.length;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const saved=new Set(JSON.parse(localStorage.getItem('wath32-saved')||'[]'));
const progress=JSON.parse(localStorage.getItem('wath32-progress')||'{}');
function persist(){localStorage.setItem('wath32-saved',JSON.stringify([...saved]));localStorage.setItem('wath32-progress',JSON.stringify(progress))}
function notify(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
function showDialog(dialog){if(!dialog.open)dialog.showModal()}
function closeDialogs(){ $$('dialog[open]').forEach(d=>d.close()) }

let adBlockerActive=localStorage.getItem('moviebox-adblock')!=='false';
let blockedRedirectsCount=parseInt(localStorage.getItem('moviebox-adblock-count')||'0',10);
let currentStreamServer=localStorage.getItem('moviebox-stream-server')||'vidsrc-sh';
let lastAdblockToast=0;

function recordBlockedAd(reason='redirect'){
  blockedRedirectsCount++;
  localStorage.setItem('moviebox-adblock-count',String(blockedRedirectsCount));
  updateAdBlockUI();
  const now=Date.now();
  if(now-lastAdblockToast>2500){
    lastAdblockToast=now;
    notify(`🛡️ Ad Blocker: Blocked ${reason}`);
  }
}

const originalWindowOpen=window.open;
window.open=function(...args){
  if(adBlockerActive){
    console.warn('[MovieBox AdBlocker] Blocked window.open popup attempt:',...args);
    recordBlockedAd('popup redirect');
    return null;
  }
  return originalWindowOpen.apply(window,args);
};

if(window.navigation){
  window.navigation.addEventListener('navigate',e=>{
    try{
      const dest=new URL(e.destination.url);
      if(dest.origin!==window.location.origin&&$('#player-dialog')?.open&&adBlockerActive){
        e.preventDefault();
        recordBlockedAd('top redirect attempt');
        notify('🛡️ Ad Blocker: Blocked site redirect');
      }
    }catch{}
  });
}

window.addEventListener('beforeunload',e=>{
  if(adBlockerActive&&$('#player-dialog')?.open&&activeMovie?.source==='TMDB'){
    e.preventDefault();
    e.returnValue='MovieBox is currently playing.';
    recordBlockedAd('page redirect attempt');
    return 'MovieBox is currently playing.';
  }
});

window.addEventListener('click',e=>{
  if(!adBlockerActive)return;
  const link=e.target.closest('a');
  if(link&&link.href){
    try{
      const targetUrl=new URL(link.href,window.location.href);
      if($('#player-dialog')?.open&&targetUrl.origin!==window.location.origin&&!targetUrl.hostname.includes('themoviedb.org')){
        e.preventDefault();
        e.stopPropagation();
        recordBlockedAd('external link redirect');
      }
    }catch{}
  }
},true);

window.addEventListener('blur',()=>{
  if(adBlockerActive&&$('#player-dialog')?.open&&activeMovie?.source==='TMDB'){
    setTimeout(()=>{
      window.focus();
      recordBlockedAd('background popup');
    },100);
  }
});

function applyAdBlockerSandbox(){
  const frame=$('#stream-player');
  if(!frame)return;
  if(frame.hasAttribute('sandbox')){
    frame.removeAttribute('sandbox');
  }
}

function updateAdBlockUI(){
  const playerBtn=$('#player-adblock-btn'),countBadge=$('#adblock-count'),topBtn=$('#top-adblock-btn');
  const settingToggle=$('#adblock-setting-toggle'),settingLabel=$('#adblock-setting-label'),statsSummary=$('#adblock-stats-summary');
  if(playerBtn){
    playerBtn.classList.toggle('active',adBlockerActive);
    playerBtn.classList.toggle('off',!adBlockerActive);
    const label=playerBtn.querySelector('.adblock-label');
    if(label)label.textContent=adBlockerActive?'Ad Shield: ON':'Ad Shield: OFF';
    playerBtn.title=adBlockerActive?`Inbuilt Ad & Redirect Blocker: ON (${blockedRedirectsCount} blocked). Click to pause.`:'Inbuilt Ad & Redirect Blocker: PAUSED. Click to enable.';
  }
  if(countBadge){
    countBadge.hidden=!adBlockerActive||blockedRedirectsCount===0;
    countBadge.textContent=`${blockedRedirectsCount} blocked`;
  }
  if(topBtn){
    topBtn.classList.toggle('active',adBlockerActive);
    topBtn.classList.toggle('off',!adBlockerActive);
    topBtn.title=adBlockerActive?`Inbuilt Ad Blocker: Active (${blockedRedirectsCount} blocked). Click to toggle.`:'Inbuilt Ad Blocker: Paused. Click to enable.';
  }
  if(settingToggle)settingToggle.checked=adBlockerActive;
  if(settingLabel)settingLabel.textContent=adBlockerActive?'Protection Active':'Protection Paused';
  if(statsSummary){
    statsSummary.textContent=adBlockerActive?`${blockedRedirectsCount} blocked · Shield active`:'Protection paused';
  }
}

function setAdBlocker(enabled){
  adBlockerActive=Boolean(enabled);
  localStorage.setItem('moviebox-adblock',adBlockerActive?'true':'false');
  applyAdBlockerSandbox();
  updateAdBlockUI();
  notify(adBlockerActive?'🛡️ Inbuilt Ad Blocker enabled · Redirects blocked':'⚠️ Ad Blocker paused · Embed unrestricted');
  if(activeMovie&&activeMovie.source==='TMDB'&&$('#player-dialog')?.open){
    playMovie(activeMovie);
  }
}

function getStreamUrl(server,type,tmdbId,startAt=0){
  const params=new URLSearchParams({ds_lang:'en'});
  if(startAt>0)params.set('startAt',String(Math.floor(startAt)));
  const query=params.toString()?'?'+params.toString():'';
  switch(server){
    case 'vidsrc-cc':return `https://vidsrc.cc/v2/embed/${type}/${encodeURIComponent(tmdbId)}${query}`;
    case 'autoembed':return `https://player.autoembed.cc/embed/${type}/${encodeURIComponent(tmdbId)}`;
    case 'smashy':return `https://embed.smashystream.com/playere.php?tmdb=${encodeURIComponent(tmdbId)}${type==='tv'?'&season=1&episode=1':''}`;
    case 'vidsrc-sh':
    default:return `https://vidsrc.sh/embed/${type}/${encodeURIComponent(tmdbId)}${type==='tv'?'':query}${type==='tv'?query:''}`;
  }
}
function card(movie){const pct=progress[movie.id]?.pct||0;return `<article class="movie-card" data-id="${movie.id}"><div class="poster"><div class="poster-art" style="background-image:url('${movie.poster}')"></div>${movie.tag?`<span class="poster-tag">ORIGINAL</span>`:''}<span class="poster-title">${movie.title}</span><div class="card-actions"><button class="save-card ${saved.has(movie.id)?'saved':''}" aria-label="${saved.has(movie.id)?'Remove from':'Add to'} My list" title="My list">${saved.has(movie.id)?'♥':'＋'}</button></div>${pct?`<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`:''}</div><div class="card-info"><p class="card-title">${movie.title}</p><div class="card-meta"><span>${movie.year||'Classic'}</span><span>·</span><span>${movie.genre}</span>${movie.rating?`<span class="card-rating">★ ${movie.rating}</span>`:''}</div></div></article>`}
function render(){const filtered=filteredMovies(),kind=$('#media-type').value==='tv'?'TV shows':'films';$('#featured-row').innerHTML=filtered.slice(0,5).map(card).join('');$('#wonder-row').innerHTML=filtered.slice(5,10).map(card).join('');const watching=catalog.filter(m=>progress[m.id]?.pct>0&&progress[m.id]?.pct<95);$('#continue').hidden=!watching.length;$('#continue-row').innerHTML=watching.map(card).join('');const search=$('#search-input')?.value.trim(),hasFilter=$('#genre-filter').value!=='all'||$('#year-filter').value!=='all';if(search||hasFilter){const found=search?catalog.filter(m=>`${m.title} ${m.genre} ${m.year} ${m.description}`.toLowerCase().includes(search.toLowerCase())):filtered;$('#results-section').hidden=false;$('#results-title').textContent=search?`Results for “${search}”`:`Filtered ${kind}`;$('#results-count').textContent=totalPages>1?`${totalResults.toLocaleString()} titles · Page ${currentPage} of ${totalPages}`:`${found.length} ${found.length===1?'title':'titles'}`;$('#results-grid').innerHTML=found.map(card).join('')}else{$('#results-section').hidden=filtered.length<=10&&totalPages<=1;$('#results-title').textContent=`More ${kind}`;$('#results-count').textContent=totalPages>1?`${totalResults.toLocaleString()} titles · Page ${currentPage} of ${totalPages}`:`${catalog.length} titles in library`;$('#results-grid').innerHTML=filtered.slice(10).map(card).join('')}renderPagination();bindCards()}
function renderPagination(){const nav=$('#pagination');nav.hidden=totalPages<=1;const start=Math.max(1,Math.min(currentPage-2,totalPages-4)),end=Math.min(totalPages,start+4);let html=`<button class="page-button" data-page="${currentPage-1}" ${currentPage===1?'disabled':''} aria-label="Previous page">‹</button>`;for(let p=start;p<=end;p++)html+=`<button class="page-button ${p===currentPage?'current':''}" data-page="${p}" ${p===currentPage?'aria-current="page"':''}>${p}</button>`;html+=`<button class="page-button" data-page="${currentPage+1}" ${currentPage===totalPages?'disabled':''} aria-label="Next page">›</button>`;nav.innerHTML=html;nav.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{const page=Number(b.dataset.page);if(page>=1&&page<=totalPages)loadTMDBCatalog(searchInput.value.trim(),page)})}
function filteredMovies(){let list=[...catalog];const genre=$('#genre-filter').value,year=$('#year-filter').value,sort=$('#sort-filter').value;if(genre!=='all')list=list.filter(m=>(m.genres||m.genre.split(',').map(x=>x.trim())).some(g=>g.toLowerCase()===genre.toLowerCase()));if(year!=='all')list=list.filter(m=>String(m.year)===year);if(sort==='rating')list.sort((a,b)=>b.rating-a.rating);if(sort==='newest')list.sort((a,b)=>b.year-a.year);if(sort==='az')list.sort((a,b)=>a.title.localeCompare(b.title));return list}
function refreshFilterOptions(){const g=$('#genre-filter'),y=$('#year-filter'),oldG=g.value,oldY=y.value;const genres=[...new Set(catalog.flatMap(m=>m.genres||m.genre.split(',').map(x=>x.trim())).filter(Boolean))];g.innerHTML='<option value="all">All genres</option>'+genres.sort().map(v=>`<option value="${v}">${v}</option>`).join('');y.innerHTML='<option value="all">Any year</option>'+[...new Set(catalog.map(m=>m.year).filter(Boolean))].sort((a,b)=>b-a).map(v=>`<option value="${v}">${v}</option>`).join('');g.value=[...g.options].some(o=>o.value===oldG)?oldG:'all';y.value=[...y.options].some(o=>o.value===oldY)?oldY:'all';}
function bindCards(){$$('.movie-card').forEach(el=>{el.onclick=()=>openInfo(catalog.find(m=>m.id===el.dataset.id));el.querySelector('.save-card').onclick=e=>{e.stopPropagation();const id=el.dataset.id;saved.has(id)?saved.delete(id):saved.add(id);persist();render();notify(saved.has(id)?'Added to My list':'Removed from My list')}})}
function openInfo(movie){if(!movie)return;activeMovie=movie;$('#info-title').textContent=movie.title;$('#info-meta').textContent=[movie.year||'Classic',(movie.genres||[movie.genre]).join(', '),movie.rating?`★ ${movie.rating.toFixed(1)}`:'',movie.duration,movie.source].filter(Boolean).join(' · ');$('#info-description').textContent=movie.source==='Internet Archive'?`${movie.description} Source: Internet Archive. Rights and playback availability vary by item; check the source record before use.`:movie.source==='TMDB'?`${movie.description} Details and regional viewing options from TMDB.`:movie.description;$('#info-cover').style.backgroundImage=`url('${movie.backdrop||movie.poster}')`;$('#info-kicker').textContent=movie.mediaType==='tv'?'TV SERIES':movie.tag||movie.source||'FEATURED TITLE';const canPlay=Boolean(movie.videoUrl||(movie.source==='TMDB'&&movie.tmdbId));const play=$('#info-play');play.disabled=!canPlay;play.textContent=canPlay?'▶  Play':'No stream linked';play.onclick=()=>{if(!canPlay)return;$('#info-dialog').close();playMovie(movie)};$('#info-save').textContent=saved.has(movie.id)?'♥  In my list':'＋  My list';$('#info-save').onclick=()=>{saved.has(movie.id)?saved.delete(movie.id):saved.add(movie.id);persist();$('#info-save').textContent=saved.has(movie.id)?'♥  In my list':'＋  My list';render();notify(saved.has(movie.id)?'Added to My list':'Removed from My list')};const panel=$('#provider-panel');panel.hidden=movie.source!=='TMDB';$('#provider-note').textContent='Checking free availability…';$('#provider-links').innerHTML='';showDialog($('#info-dialog'));if(movie.source==='TMDB'){const region=$('#region-filter').value;fetch(`/api/title/${movie.mediaType||'movie'}/${movie.tmdbId}`).then(r=>r.ok?r.json():null).then(d=>{if(!d||activeMovie!==movie)return;movie.duration=movie.mediaType==='tv'?`${d.number_of_seasons||0} seasons · ${d.number_of_episodes||0} episodes`:d.runtime?`${Math.floor(d.runtime/60)}h ${d.runtime%60}m`:'';movie.genres=(d.genres||[]).map(g=>g.name);movie.genre=movie.genres.join(', ')||movie.genre;const cast=(d.credits?.cast||d.aggregate_credits?.cast||[]).slice(0,5).map(p=>p.name).join(', ');$('#info-meta').textContent=[movie.year,movie.genres.join(', '),movie.rating?`★ ${movie.rating.toFixed(1)}`:'',movie.duration].filter(Boolean).join(' · ');$('#info-description').textContent=`${d.overview||movie.description}${d.tagline?` “${d.tagline}”`:''}${cast?` Cast: ${cast}.`:''} TMDB metadata; viewing options vary by region.`}).catch(()=>{});fetch(`/api/providers/${movie.mediaType||'movie'}/${movie.tmdbId}?region=${region}`).then(r=>r.ok?r.json():null).then(data=>{if(activeMovie!==movie)return;const free=data?.free||[],ads=data?.ads||[],items=free.length?free:ads;$('#provider-note').textContent=items.length?`${free.length?'Free':'Free with ads'} options in ${$('#region-filter').selectedOptions[0].textContent}: ${items.map(p=>p.provider_name).join(', ')}.`:`No free provider is listed in ${$('#region-filter').selectedOptions[0].textContent}.`;$('#provider-links').innerHTML=data?.link?`<a class="provider-link" href="${data.link}" target="_blank" rel="noopener noreferrer">See viewing options on TMDB ↗</a>`:''}).catch(()=>{$('#provider-note').textContent='Provider availability is temporarily unavailable.'})}}
function playMovie(movie){activeMovie=movie;const video=$('#video-player'),frame=$('#stream-player'),embedded=movie.source==='TMDB'&&movie.tmdbId;video.pause();video.removeAttribute('src');video.querySelectorAll('track').forEach(t=>t.remove());frame.removeAttribute('src');video.hidden=Boolean(embedded);frame.hidden=!embedded;$('#quality-option').hidden=Boolean(embedded);$('#subtitle-option').hidden=Boolean(embedded);$('#server-option').hidden=!embedded;$('#player-reload').hidden=!embedded;$('#player-note').textContent=embedded?(adBlockerActive?'Playback protected by MovieBox Inbuilt Ad & Redirect Shield.':'Streaming without ad blocker. Redirect protection is paused.'):'Playback provided in crisp 1080p Full HD.';$('#player-title').textContent=movie.title;$('#player-subtitle').textContent=`${movie.tag?'A MovieBox Original · ':''}${movie.year||''}${movie.duration?` · ${movie.duration}`:''}`;if(embedded){applyAdBlockerSandbox();const type=movie.mediaType==='tv'?'tv':'movie',savedProgress=progress[movie.id],startAt=savedProgress?.time||0;if($('#server-select'))$('#server-select').value=currentStreamServer;frame.src=getStreamUrl(currentStreamServer,type,movie.tmdbId,startAt);const serverName=$('#server-select')?.selectedOptions[0]?.textContent||'VIDSRC';$('#player-label').textContent=adBlockerActive?`${serverName.toUpperCase()} · SHIELD ACTIVE`:`${serverName.toUpperCase()} PLAYER`;$('#quality-select').innerHTML='<option value="auto">Player controls</option>';$('#subtitle-select').innerHTML='<option value="off">Player controls</option>';updateAdBlockUI()}else{const qMap=movie.qualityUrls||DEMO_QUALITIES;const initialQuality=qMap['1080']?'1080':(Object.keys(qMap)[0]||'auto');video.src=qMap[initialQuality]||movie.videoUrl||DEMO_1080P;if(movie.subtitlesUrl){const track=document.createElement('track');track.kind='subtitles';track.label=movie.subtitleLabel||'English';track.srclang=movie.subtitleLanguage||'en';track.src=movie.subtitlesUrl;video.append(track)}$('#player-label').textContent=movie.videoUrl?'NOW PLAYING · FULL HD':'DEMO PLAYER · 1080P FULL HD';let qOptions='<option value="auto">Auto (1080p)</option>';if(qMap['1080'])qOptions+=`<option value="1080" ${initialQuality==='1080'?'selected':''}>1080p Full HD</option>`;if(qMap['720'])qOptions+=`<option value="720" ${initialQuality==='720'?'selected':''}>720p HD</option>`;if(qMap['480'])qOptions+=`<option value="480" ${initialQuality==='480'?'selected':''}>480p SD</option>`;for(const k of Object.keys(qMap)){if(!['1080','720','480'].includes(k))qOptions+=`<option value="${k}">${k}p</option>`}$('#quality-select').innerHTML=qOptions;$('#quality-select').value=initialQuality;$('#quality-select').onchange=()=>{const next=$('#quality-select').value,targetUrl=next==='auto'?(qMap['1080']||movie.videoUrl||DEMO_1080P):(qMap[next]||movie.videoUrl||DEMO_1080P),at=video.currentTime,wasPlaying=!video.paused;video.src=targetUrl;video.onloadedmetadata=()=>{video.currentTime=at;if(wasPlaying)video.play().catch(()=>{})};notify(`Quality set to ${next==='auto'?'Auto (1080p Full HD)':next+'p'+(next==='1080'?' Full HD':'')}`)};$('#subtitle-select').innerHTML=`<option value="off">Off</option>${movie.subtitlesUrl?`<option value="en">${movie.subtitleLabel||'English'}</option>`:''}`;$('#subtitle-select').value='off';$('#subtitle-select').onchange=e=>{video.querySelectorAll('track').forEach(t=>t.track.mode=e.target.value==='off'?'disabled':'showing')};video.onloadedmetadata=()=>{const savedProgress=progress[movie.id];if(savedProgress?.time&&savedProgress.time<video.duration-5)video.currentTime=savedProgress.time};video.ontimeupdate=()=>{if(video.duration){progress[movie.id]={time:video.currentTime,pct:Math.min(100,Math.round(video.currentTime/video.duration*100))};persist();if(Math.round(video.currentTime)%15===0)render()}}}showDialog($('#player-dialog'));if(!embedded)video.play().catch(()=>{})}
window.addEventListener('message',event=>{if(!activeMovie||event.source!==$('#stream-player')?.contentWindow)return;const payload=event.data;if(payload?.type!=='PLAYER_EVENT')return;const data=payload.data||{},seconds=Number(data.player_progress),duration=Number(data.player_duration);if(Number.isFinite(seconds)){progress[activeMovie.id]={time:seconds,pct:duration>0?Math.min(100,Math.round(seconds/duration*100)):(progress[activeMovie.id]?.pct||0)};persist();if(data.player_status==='completed')progress[activeMovie.id].pct=100}});
let iframeWasBackgrounded=false;document.addEventListener('visibilitychange',()=>{if(document.hidden){iframeWasBackgrounded=true;return}if(!iframeWasBackgrounded)return;iframeWasBackgrounded=false;if(!adBlockerActive&&!document.hidden&&activeMovie?.source==='TMDB'&&$('#player-dialog').open){setTimeout(()=>{playMovie(activeMovie)},350)}});
$('#hero-play').onclick=()=>playMovie(movies[0]);$('#hero-info').onclick=()=>openInfo(movies[0]);$('#filter-toggle').onclick=()=>{$('#filter-panel').hidden=!$('#filter-panel').hidden};['genre-filter','year-filter','sort-filter','media-type','availability-filter','region-filter'].forEach(id=>$('#'+id).onchange=()=>catalog.some(m=>m.source==='TMDB')?loadTMDBCatalog(searchInput.value.trim(),1).catch(err=>notify(err.message)):render());$('#clear-filters').onclick=()=>{$('#genre-filter').value='all';$('#year-filter').value='all';$('#sort-filter').value='featured';if(catalog.some(m=>m.source==='TMDB'))loadTMDBCatalog(searchInput.value.trim(),1).catch(err=>notify(err.message));else render()};$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));$('#search-toggle')?.addEventListener('click',()=>$('#search-input')?.focus());
let searchTimer,searchRequest=0;const searchInput=document.createElement('input');searchInput.id='search-input';searchInput.type='search';searchInput.placeholder='Search titles, genres…';searchInput.setAttribute('aria-label','Search titles');searchInput.className='search-input';$('.top-actions').insertBefore(searchInput,$('.profile-button'));$('.search-toggle').onclick=()=>{searchInput.classList.toggle('open');if(searchInput.classList.contains('open'))searchInput.focus();else{searchInput.value='';render();if(catalog.some(m=>m.source==='TMDB'))refreshTMDBCatalog('')}};searchInput.oninput=()=>{render();if(catalog.some(m=>m.source==='TMDB')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshTMDBCatalog(searchInput.value.trim()),320)}};searchInput.onkeydown=e=>{if(e.key==='Escape'){searchInput.value='';searchInput.classList.remove('open');render();if(catalog.some(m=>m.source==='TMDB'))refreshTMDBCatalog('')}};
$$('.main-nav .nav-link').forEach(link=>link.addEventListener('click',()=>{const type=link.dataset.mediaType;if(type){$('#media-type').value=type;loadTMDBCatalog(searchInput.value.trim(),1).catch(err=>notify(err.message))}$$('.main-nav .nav-link').forEach(item=>item.classList.toggle('active',item===link))}));
$('#server-settings').onclick=()=>{const cfg=JSON.parse(localStorage.getItem('wath32-server')||'{}');$('#server-url').value=cfg.url||'';$('#server-token').value=cfg.token||'';showDialog($('#server-dialog'))};$('#server-form').onsubmit=async e=>{e.preventDefault();const url=$('#server-url').value.trim(),token=$('#server-token').value.trim();if(!url){localStorage.removeItem('wath32-server');catalog=[...movies];refreshFilterOptions();$('#server-dialog').close();render();loadInternetArchive();return}localStorage.setItem('wath32-server',JSON.stringify({url,token}));try{const res=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!res.ok)throw Error(`Server returned ${res.status}`);const data=await res.json();if(!Array.isArray(data))throw Error('Catalog response must be a JSON array');catalog=data.map((m,i)=>({...m,id:String(m.id??`server-${i}`),year:Number(m.year)||2025,rating:Number(m.rating)||0,genre:m.genre||'Film',duration:m.duration||'',description:m.description||'',poster:m.poster||'',videoUrl:m.videoUrl||'',subtitlesUrl:m.subtitlesUrl||''}));currentPage=1;totalPages=1;totalResults=catalog.length;refreshFilterOptions();$('#server-dialog').close();render();notify(`Connected · ${catalog.length} titles`)}catch(err){notify(`Couldn’t connect: ${err.message}`)}};
function formatDuration(value){if(!value)return'';const mins=Math.round(parseFloat(String(value).replace(/[^0-9.]/g,''))*60);return Number.isFinite(mins)&&mins?`${Math.floor(mins/60)}h ${mins%60}m`:String(value)}
function stripHtml(value){if(!value)return'';const el=document.createElement('div');el.innerHTML=String(value);return(el.textContent||'').trim().slice(0,600)}
async function loadInternetArchive(){try{const fields=['identifier','title','year','description','creator','subject','runtime'];const params=new URLSearchParams({q:'collection:feature_films AND mediatype:movies',rows:'40',page:'1',output:'json'});fields.forEach(f=>params.append('fl[]',f));const res=await fetch(`https://archive.org/advancedsearch.php?${params}`);if(!res.ok)throw Error(`Catalog returned ${res.status}`);const payload=await res.json(),docs=payload.response?.docs||[];const items=await Promise.all(docs.slice(0,30).map(async d=>{try{const mr=await fetch(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`);if(!mr.ok)return null;const meta=await mr.json(),files=meta.files||[];const mp4Files=files.filter(f=>/\.mp4$/i.test(f.name||'')&&!f.name?.includes('__ia_thumb'));if(!mp4Files.length)return null;mp4Files.sort((a,b)=>(Number(b.height)||0)-(Number(a.height)||0)||(Number(b.size)||0)-(Number(a.size)||0));const video=mp4Files[0],qMap={};for(const f of mp4Files){const h=Number(f.height)||0,fUrl=`https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(f.name)}`;if(h>=1000&&!qMap['1080'])qMap['1080']=fUrl;else if(h>=700&&!qMap['720'])qMap['720']=fUrl;else if(h>=400&&!qMap['480'])qMap['480']=fUrl}if(!Object.keys(qMap).length){qMap['1080']=`https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(video.name)}`}const title=Array.isArray(d.title)?d.title[0]:d.title,subjects=Array.isArray(d.subject)?d.subject:typeof d.subject==='string'?d.subject.split(';'):[],genre=subjects.find(s=>/drama|comedy|horror|western|adventure|science fiction|documentary|thriller/i.test(s))||'Classic film',description=Array.isArray(d.description)?d.description[0]:d.description;return{id:String(d.identifier),title:title||d.identifier,year:Number((Array.isArray(d.year)?d.year[0]:d.year)||meta.metadata?.year)||0,genre:genre.split(/[,;]/)[0].trim(),rating:0,duration:formatDuration(d.runtime||meta.metadata?.runtime),poster:`https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,description:stripHtml(description)||'A film from the Internet Archive feature film collection.',videoUrl:qMap['1080']||`https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(video.name)}`,qualityUrls:qMap,source:'Internet Archive',license:meta.metadata?.licenseurl||'Check item record'}}catch{return null}}));catalog=items.filter(Boolean);if(!catalog.length)throw Error('No playable MP4 films were found in this collection');currentPage=1;totalPages=1;totalResults=catalog.length;refreshFilterOptions();const first=catalog[0];$('#hero-title').textContent=first.title.toUpperCase();$('#hero-description').textContent=first.description;$('#hero-eyebrow').textContent='INTERNET ARCHIVE CLASSIC · FULL HD';$('#hero-match').textContent='Internet Archive';$('#hero-year').textContent=first.year||'Classic';$('#hero-rating').textContent='Free in 1080p';$('#hero-play').onclick=()=>playMovie(first);$('#hero-info').onclick=()=>openInfo(first);$('.hero-art').style.backgroundImage=`linear-gradient(90deg,rgba(9,11,16,.96) 0%,rgba(9,11,16,.75) 35%,rgba(9,11,16,.16) 75%),linear-gradient(0deg,#090b10 0%,transparent 30%),url('${first.poster}')`;render();notify(`Loaded ${catalog.length} classic films in Full HD`)}catch(err){console.warn('Internet Archive catalog unavailable',err);notify('Free catalog unavailable · Showing demo titles')}}
async function refreshTMDBCatalog(query='',page=1){const request=++searchRequest;currentPage=page;const params=new URLSearchParams({page:String(page),genre:$('#genre-filter').value,year:$('#year-filter').value,sort:$('#sort-filter').value,type:$('#media-type').value,availability:$('#availability-filter').value,region:$('#region-filter').value});if(query)params.set('query',query);const res=await fetch(`/api/catalog?${params}`);if(!res.ok){const detail=await res.json().catch(()=>({}));throw Error(detail.error||'TMDB catalog is unavailable')}const payload=await res.json();if(request!==searchRequest)return;if(!payload.results?.length&&query){catalog=[];totalPages=1;totalResults=0;render();return}if(!payload.results?.length)throw Error('TMDB returned no titles for these filters');catalog=payload.results;currentPage=payload.page||page;totalPages=payload.totalPages||1;totalResults=payload.total||catalog.length;refreshFilterOptions();if(!query&&currentPage===1&&$('#genre-filter').value==='all'&&$('#year-filter').value==='all'){const first=catalog[0];$('#hero-title').textContent=first.title.toUpperCase();$('#hero-description').textContent=first.description;$('#hero-eyebrow').textContent=$('#media-type').value==='tv'?'POPULAR TV ON MOVIEBOX':'POPULAR ON MOVIEBOX';$('#hero-match').textContent='TMDB';$('#hero-year').textContent=first.year||'Movie';$('#hero-rating').textContent=first.rating?`★ ${first.rating.toFixed(1)}`:'Movie';$('#hero-play').textContent='More info';$('#hero-play').onclick=()=>openInfo(first);$('#hero-info').onclick=()=>openInfo(first);$('.hero-art').style.backgroundImage=`linear-gradient(90deg,rgba(9,11,16,.96) 0%,rgba(9,11,16,.75) 35%,rgba(9,11,16,.16) 75%),linear-gradient(0deg,#090b10 0%,transparent 30%),url('${first.backdrop||first.poster}')`}render()}
async function loadTMDBCatalog(query='',page=1){await refreshTMDBCatalog(query,page);if(!query)notify(`Loaded ${catalog.length} ${$('#media-type').value==='tv'?'TV shows':'movies'} from TMDB`)}
function toggleFullscreen(){const dialog=$('#player-dialog'),video=$('#video-player'),frame=$('#stream-player'),target=video.hidden?frame:video;if(!document.fullscreenElement&&!document.webkitFullscreenElement){if(target.requestFullscreen)target.requestFullscreen().catch(()=>{dialog.requestFullscreen?.().catch(()=>{})});else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();else if(dialog.requestFullscreen)dialog.requestFullscreen().catch(()=>{})}else{if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});else if(document.webkitExitFullscreen)document.webkitExitFullscreen()}}
$('#player-fullscreen')?.addEventListener('click',toggleFullscreen);
$('#player-adblock-btn')?.addEventListener('click',()=>setAdBlocker(!adBlockerActive));
$('#top-adblock-btn')?.addEventListener('click',()=>setAdBlocker(!adBlockerActive));
$('#adblock-setting-toggle')?.addEventListener('change',e=>setAdBlocker(e.target.checked));
$('#server-select')?.addEventListener('change',e=>{currentStreamServer=e.target.value;localStorage.setItem('moviebox-stream-server',currentStreamServer);if(activeMovie&&activeMovie.source==='TMDB'&&$('#player-dialog')?.open){notify(`Switched to ${e.target.selectedOptions[0]?.textContent||'server'}`);playMovie(activeMovie)}});
$('#player-reload')?.addEventListener('click',()=>{if(activeMovie&&$('#player-dialog')?.open){notify('↻ Reloading stream with Ad Shield active…');playMovie(activeMovie)}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.metaKey&&!e.ctrlKey){e.preventDefault();searchInput.classList.add('open');searchInput.focus()}if((e.key==='f'||e.key==='F')&&!e.metaKey&&!e.ctrlKey&&$('#player-dialog')?.open&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();toggleFullscreen()}});
applyAdBlockerSandbox();
updateAdBlockUI();
refreshFilterOptions();
render();
loadTMDBCatalog().catch(err=>{console.warn('TMDB catalog unavailable',err);notify('TMDB unavailable · Loading free classic films');loadInternetArchive()});
