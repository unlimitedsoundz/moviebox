const DEMO_1080P = 'https://archive.org/download/Sintel/sintel-2048-stereo.mp4';
const DEMO_720P = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.720p.vp9.webm';
const DEMO_480P = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
const DEMO_QUALITIES = { '1080': DEMO_1080P, '720': DEMO_720P, '480': DEMO_480P };
const DEMO_VIDEO = DEMO_1080P;
const art = (id, w=650) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=82`;
const movies = [
  {id:'tmdb-movie-687163',tmdbId:687163,mediaType:'movie',title:'Project Hail Mary',year:2026,genre:'Science Fiction, Adventure',genres:['Science Fiction','Adventure'],rating:8.6,duration:'2h 15m',poster:'https://image.tmdb.org/t/p/w500/iOb2fjXLbpJgyQXe46n1WtGCnaa.jpg',backdrop:'https://image.tmdb.org/t/p/w1280/8Tfys3mDZVp4tNoH2ktm06a0Tau.jpg',description:'Science teacher Ryland Grace wakes up on a spaceship light years from home with no recollection of who he is or how he got there. As his memory returns, he begins to uncover his mission: solve the riddle of the mysterious substance causing the sun to die out.',videoUrl:'',source:'TMDB',voteCount:8824},
  {id:'tmdb-movie-1423191',tmdbId:1423191,mediaType:'movie',title:'Resident Evil',year:2026,genre:'Horror, Science Fiction, Adventure',genres:['Horror','Science Fiction','Adventure'],rating:7.5,duration:'1h 48m',poster:'https://image.tmdb.org/t/p/w500/gAgWJhUSQWCgtKR8170nMkYlBda.jpg',backdrop:'https://image.tmdb.org/t/p/w1280/8R79AZjX1Bt4219Ub3CrRMsPQsW.jpg',description:'Medical courier Bryan unwittingly finds himself fighting for survival as one fateful, horrifying night collapses around him in chaos.',videoUrl:'',source:'TMDB',voteCount:2066},
  {id:'tmdb-movie-1263337',tmdbId:1263337,mediaType:'movie',title:'Heart of the Beast',year:2026,genre:'Adventure, Thriller',genres:['Adventure','Thriller'],rating:7.5,duration:'1h 52m',poster:'https://image.tmdb.org/t/p/w500/6sYemVUn79UPKz1ZsSG6kPU4RVy.jpg',backdrop:'https://image.tmdb.org/t/p/w1280/6uVRPFflyJpo8Cx872olmlGTWla.jpg',description:'After a harrowing plane crash, Special Forces officer James Belmont and his combat dog, Odin, find themselves stranded deep in the Alaskan wilderness. Together, they are forced into a brutal fight for survival against the elements.',videoUrl:'',source:'TMDB',voteCount:666},
  {id:'tmdb-movie-155',tmdbId:155,mediaType:'movie',title:'The Dark Knight',year:2008,genre:'Action, Thriller, Crime',genres:['Action','Thriller','Crime'],rating:8.5,duration:'2h 32m',poster:'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',backdrop:'https://image.tmdb.org/t/p/w1280/cfT29Im5VDvjE0RpyKOSdCKZal7.jpg',description:'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.',videoUrl:'',source:'TMDB',voteCount:37339},
  {id:'tmdb-movie-1368337',tmdbId:1368337,mediaType:'movie',title:'The Odyssey',year:2026,genre:'Adventure, Action, Fantasy',genres:['Adventure','Action','Fantasy'],rating:8.0,duration:'2h 20m',poster:'https://image.tmdb.org/t/p/w500/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg',backdrop:'https://image.tmdb.org/t/p/w1280/twiVn9oFXOVR0uoYgawyEBlnFu8.jpg',description:'Odysseus, the legendary King of Ithaca, embarks on a long and perilous journey home following the Trojan War. Throughout his voyage, he is forced to confront the whims of gods, mythological monsters, and trials that stretch both his cunning and his humanity.',videoUrl:'',source:'TMDB',voteCount:4682}
];
let catalog=[...movies], recentCatalog=[], homeShelves=null, activeMovie=movies[0], toastTimer,currentPage=1,totalPages=1,totalResults=movies.length;
function readStorage(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
const saved=new Set(readStorage('wath32-saved',[]));
const savedItems=readStorage('wath32-saved-items',{});
const progress=readStorage('wath32-progress',{});
const progressItems=readStorage('wath32-progress-items',{});
const titleMetaCache=new Map();
const pendingTvFetches=new Map();
const pendingSeasonFetches=new Map();

function isTvSeries(m){
  if(!m)return false;
  return Boolean(
    m.mediaType==='tv'||
    String(m.id).includes('tmdb-tv-')||
    (Array.isArray(m.seasons)&&m.seasons.length>0)||
    (Number(m.numberOfSeasons)>0)||
    m.isTV
  );
}

function savePlaybackProgress(movieId,{season,episode,time,duration,completed=false}={}){
  if(!movieId)return;
  const t=Math.max(0,Math.floor(Number(time)||0));
  const d=Math.max(0,Math.floor(Number(duration)||0));
  const pct=completed?100:(d>0?Math.min(100,Math.max(1,Math.round((t/d)*100))):(t>0?Math.min(95,Math.max(5,Math.round(t/60))):0));
  const existing=progress[movieId]||{};
  existing.time=t;
  existing.duration=d||existing.duration||0;
  existing.pct=pct;
  existing.updatedAt=Date.now();
  if(season!==undefined&&episode!==undefined){
    const sNum=Number(season)||1;
    const eNum=Number(episode)||1;
    existing.season=sNum;
    existing.episode=eNum;
    existing.episodes=existing.episodes||{};
    existing.episodes[`s${sNum}e${eNum}`]={
      time:t,
      duration:d,
      pct,
      updatedAt:Date.now()
    };
  }
  progress[movieId]=existing;
  persist();
}

function getResumeProgress(movieId,season,episode){
  const p=progress[movieId];
  if(!p)return{time:0,duration:0,pct:0};
  if(season!==undefined&&episode!==undefined){
    const sNum=Number(season)||1;
    const eNum=Number(episode)||1;
    const key=`s${sNum}e${eNum}`;
    if(p.episodes&&p.episodes[key]){
      return p.episodes[key];
    }
    if(Number(p.season)===sNum&&Number(p.episode)===eNum){
      return{time:Number(p.time)||0,duration:Number(p.duration)||0,pct:Number(p.pct)||0};
    }
    return{time:0,duration:0,pct:0};
  }
  return{time:Number(p.time)||0,duration:Number(p.duration)||0,pct:Number(p.pct)||0};
}

function findInHomeShelves(id){
  if(!homeShelves)return null;
  for(const list of Object.values(homeShelves)){
    if(!Array.isArray(list))continue;
    const hit=list.find(m=>m&&m.id===id);
    if(hit)return hit;
  }
  return null;
}

function findMovieById(id){
  if(!id)return null;
  let found=catalog.find(m=>m.id===id)||recentCatalog.find(m=>m.id===id)||findInHomeShelves(id)||savedItems[id]||progressItems[id]||movies.find(m=>m.id===id);
  if(!found&&typeof id==='string'&&id.startsWith('tmdb-')){
    const match=id.match(/^tmdb-(tv|movie)-(\d+)$/);
    if(match){
      const type=match[1],tmdbId=Number(match[2]);
      found={
        id,
        tmdbId,
        mediaType:type,
        title:type==='tv'?'TV Series':'Movie',
        genre:type==='tv'?'TV Series':'Film',
        genres:[type==='tv'?'TV Series':'Film'],
        year:0,
        rating:0,
        description:'Loading title details…',
        poster:'',
        backdrop:'',
        source:'TMDB',
        numberOfSeasons:type==='tv'?1:0,
        seasons:[]
      };
    }
  }
  if(found&&titleMetaCache.has(found.id)){
    const meta=titleMetaCache.get(found.id);
    if(meta.seasons&&(!found.seasons||!found.seasons.length))found.seasons=meta.seasons;
    if(meta.numberOfSeasons&&(!found.numberOfSeasons||found.numberOfSeasons<meta.numberOfSeasons))found.numberOfSeasons=meta.numberOfSeasons;
    if(meta.numberOfEpisodes)found.numberOfEpisodes=meta.numberOfEpisodes;
    if(meta.seasonEpisodes)found.seasonEpisodes=Object.assign(meta.seasonEpisodes,found.seasonEpisodes||{});
    if(meta.lastEpisodeToAir)found.lastEpisodeToAir=meta.lastEpisodeToAir;
    if(meta.nextEpisodeToAir)found.nextEpisodeToAir=meta.nextEpisodeToAir;
    if(meta.title&&(!found.title||found.title==='TV Series'||found.title==='Movie'))found.title=meta.title;
    if(meta.poster&&!found.poster)found.poster=meta.poster;
    if(meta.backdrop&&!found.backdrop)found.backdrop=meta.backdrop;
    if(meta.description&&found.description==='Loading title details…')found.description=meta.description;
    if(meta.genre)found.genre=meta.genre;
    if(meta.genres)found.genres=meta.genres;
    if(meta.year&&!found.year)found.year=meta.year;
  }
  return found;
}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
movies.forEach(m=>{if(saved.has(m.id)&&!savedItems[m.id])savedItems[m.id]=m});
function persist(){
  try{
    localStorage.setItem('wath32-saved',JSON.stringify([...saved]));
    localStorage.setItem('wath32-saved-items',JSON.stringify(savedItems));
    localStorage.setItem('wath32-progress',JSON.stringify(progress));
    localStorage.setItem('wath32-progress-items',JSON.stringify(progressItems));
  }catch{}
}
function notify(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
function showDialog(dialog){if(!dialog)return;document.body.classList.add('dialog-open');if(!dialog.open)dialog.showModal()}
function closeDialogs(){ $$('dialog[open]').forEach(d=>d.close());document.body.classList.remove('dialog-open') }

let adBlockerActive=localStorage.getItem('moviebox-adblock')!=='false';
let blockedRedirectsCount=parseInt(localStorage.getItem('moviebox-adblock-count')||'0',10);
const STREAM_SERVERS={vidfast:'VidFast',vidlink:'VidLink',cinesrc:'CineSrc'};
let currentStreamServer=localStorage.getItem('moviebox-stream-server-v5');
if(!STREAM_SERVERS[currentStreamServer])currentStreamServer='vidfast';
let lastAdblockToast=0, currentSeason=1, currentEpisode=1;

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

function isPlayerActive(){const stage=$('#player-stage');return Boolean(stage&&!stage.hidden)}

if(window.navigation){
  window.navigation.addEventListener('navigate',e=>{
    try{
      const dest=new URL(e.destination.url);
      if(dest.origin!==window.location.origin&&isPlayerActive()&&adBlockerActive){
        e.preventDefault();
        recordBlockedAd('top redirect attempt');
        notify('🛡️ Ad Blocker: Blocked site redirect');
      }
    }catch{}
  });
}

window.addEventListener('beforeunload',e=>{
  if(isPlayerActive()&&adBlockerActive){
    e.preventDefault();
    e.returnValue='';
    return '';
  }
});

['click','auxclick','pointerdown'].forEach(evt=>{
  window.addEventListener(evt,e=>{
    if(!adBlockerActive)return;
    const link=e.target.closest('a');
    if(link&&link.href){
      try{
        const targetUrl=new URL(link.href,window.location.href);
        if(isPlayerActive()&&targetUrl.origin!==window.location.origin&&!targetUrl.hostname.includes('themoviedb.org')){
          e.preventDefault();
          e.stopPropagation();
          if(evt==='click')recordBlockedAd('external link redirect');
        }
      }catch{}
    }
  },true);
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
  if(activeMovie&&activeMovie.source==='TMDB'&&isPlayerActive()){
    playMovie(activeMovie);
  }
}

const SVG_HEART = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const SVG_PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const SVG_PLAY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const SVG_PREV = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
const SVG_NEXT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

let activeHls=null;
function destroyHls(){
  if(activeHls){
    try{activeHls.destroy()}catch{}
    activeHls=null;
  }
}

function stopPlayer(){
  destroyHls();
  const video=$('#video-player'),frame=$('#stream-player');
  if(video){
    try{
      video.pause();
      video.removeAttribute('src');
      video.load();
    }catch{}
  }
  if(frame){
    try{
      frame.src='about:blank';
    }catch{}
  }
  const stage=$('#player-stage');
  if(stage){
    stage.hidden=true;
    stage.classList.remove('is-fullscreen');
  }
  const nhud=$('#native-player-hud');
  if(nhud){nhud.hidden=true;nhud.classList.remove('visible')}
  document.body.classList.remove('player-fullscreen-mode');
  if(document.fullscreenElement||document.webkitFullscreenElement){
    try{
      if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    }catch{}
  }
}

function formatTimestamp(sec){
  const s=Math.max(0,Math.floor(Number(sec)||0));
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;
  return h>0?`${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`:`${m}:${String(r).padStart(2,'0')}`;
}

function getStreamUrl(server,type,tmdbId,startAt=0,season=1,episode=1){
  const isTV = type === 'tv';
  const s = season || 1;
  const e = episode || 1;
  const resumeSec = Math.max(0, Math.floor(Number(startAt) || 0));
  const id = encodeURIComponent(tmdbId);
  const chosen = (server === 'cinesrc' || server === 'cinesrc-st')
    ? 'cinesrc'
    : (STREAM_SERVERS[server] ? server : 'vidfast');
  if(chosen === 'cinesrc'){
    const base = isTV
      ? `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}&autoplay=true&color=e50914&lang=en&sub=en`
      : `https://cinesrc.st/embed/movie/${id}?autoplay=true&color=e50914&lang=en&sub=en`;
    return resumeSec > 0 ? `${base}&t=${resumeSec}&startAt=${resumeSec}` : base;
  }
  if(chosen === 'vidlink'){
    const common = 'player=jwplayer&primaryColor=e50914&secondaryColor=181818&iconColor=ffffff&autoplay=false&muted=false&mute=0&volume=1&title=true&poster=false&quality=1080&defaultQuality=1080&sub_lang=en&subtitle=en&defaultSubtitle=en&captions=en&lang=en';
    const base = isTV
      ? `https://vidlink.pro/tv/${id}/${s}/${e}?${common}&nextbutton=true`
      : `https://vidlink.pro/movie/${id}?${common}`;
    return resumeSec > 0 ? `${base}&start=${resumeSec}&startAt=${resumeSec}&t=${resumeSec}` : base;
  }
  const base = isTV
    ? `https://vidfast.vc/tv/${id}/${s}/${e}?autoPlay=true&theme=E50914&title=true&poster=false&nextButton=true&autoNext=true&defaultQuality=1080&sub=en&lang=en&audio=en`
    : `https://vidfast.vc/movie/${id}?autoPlay=true&theme=E50914&title=true&poster=false&defaultQuality=1080&sub=en&lang=en&audio=en`;
  return resumeSec > 0 ? `${base}&startAt=${resumeSec}&t=${resumeSec}` : base;
}
function getUniqueMovies(items){const seen=new Set();return(items||[]).filter(m=>{if(!m)return false;const key=(m.tmdbId?`${m.mediaType||'movie'}-${m.tmdbId}`:m.id)||(m.title&&m.year?`${m.title.toLowerCase()}-${m.year}`:m.title);if(seen.has(key))return false;seen.add(key);return true})}
function shuffleArray(items){const arr=[...(items||[])];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
let currentView='home',isListView=false,recentListMode=false,homeMixedMode=true,eveningPicks=[];
function reshuffleEveningPicks(pool){
  const source=getUniqueMovies(pool||filteredMovies());
  const heroIds=new Set(heroMovies.slice(0,5).map(m=>m.id));
  const candidates=source.length>8?source.filter(m=>!heroIds.has(m.id)):source;
  eveningPicks=shuffleArray(candidates.length?candidates:source);
}
function scrollToList(){const target=$('#results-section');if(!target)return;const top=target.getBoundingClientRect().top+window.pageYOffset-68;window.scrollTo({top:Math.max(0,top),behavior:'smooth'})}
function renderMyList(){const listGrid=$('#my-list-grid'),emptyState=$('#my-list-empty'),countEl=$('#my-list-count');if(!listGrid)return;const items=[...saved].map(id=>findMovieById(id)).filter(Boolean);const uniqueSaved=getUniqueMovies(items);if(countEl)countEl.textContent=uniqueSaved.length?`${uniqueSaved.length} ${uniqueSaved.length===1?'title':'titles'} in your watchlist`:'Your saved movies and shows';if(!uniqueSaved.length){listGrid.innerHTML='';listGrid.hidden=true;if(emptyState)emptyState.hidden=false}else{if(emptyState)emptyState.hidden=true;listGrid.hidden=false;listGrid.innerHTML=uniqueSaved.map(card).join('');bindCards()}}
function escapeHtml(str){
  return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const SVG_CHECK=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const SVG_CHEVRON_DOWN=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
const SVG_CHEVRON_LEFT=`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
const SVG_CHEVRON_RIGHT=`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

function toggleSavedTitle(movie){
  if(!movie||!movie.id)return false;
  const id=movie.id;
  let nowSaved=false;
  if(saved.has(id)){
    saved.delete(id);
    delete savedItems[id];
    notify('Removed from My List');
  }else{
    saved.add(id);
    savedItems[id]=movie;
    nowSaved=true;
    notify('Added to My List');
  }
  persist();
  if(currentView==='saved')renderMyList();
  else render();
  return nowSaved;
}

function getCardBadge(movie,index,rowId){
  if(rowId==='new-releases'||movie.isRecent24h)return 'Recently Added';
  if(rowId==='top10-series'||rowId==='bingeworthy-tv'){
    if(index%3===0)return 'New Season';
    if(index%3===1)return 'New Episodes';
    return '';
  }
  if(rowId==='top10-films'||rowId==='top-picks'){
    if(index%2===0)return 'Recently Added';
    return '';
  }
  return '';
}

const logoUrlCache=new Map();
const logoFetchedIds=new Set();
const ageRatingCache=new Map();
try{
  const cachedLogos=JSON.parse(sessionStorage.getItem('moviebox-logos-v1')||'{}');
  for(const [k,v] of Object.entries(cachedLogos)){
    logoUrlCache.set(k,v);
    logoFetchedIds.add(k);
  }
}catch{}
try{
  const cachedRatings=JSON.parse(sessionStorage.getItem('moviebox-age-ratings-v1')||'{}');
  for(const [k,v] of Object.entries(cachedRatings)){
    if(v)ageRatingCache.set(k,v);
  }
}catch{}

function persistAgeRatingCache(){
  try{
    const obj={};
    for(const [k,v] of ageRatingCache.entries()){
      if(v)obj[k]=v;
    }
    sessionStorage.setItem('moviebox-age-ratings-v1',JSON.stringify(obj));
  }catch{}
}

function getMovieAgeRating(movie){
  if(!movie)return '';
  if(movie.ageRating){
    if(!ageRatingCache.has(movie.id))ageRatingCache.set(movie.id,movie.ageRating);
    return movie.ageRating;
  }
  return ageRatingCache.get(movie.id)||'';
}

function setMovieAgeRating(movie,rating){
  if(!movie||!rating)return;
  const clean=String(rating).trim();
  if(!clean)return;
  movie.ageRating=clean;
  if(ageRatingCache.get(movie.id)!==clean){
    ageRatingCache.set(movie.id,clean);
    persistAgeRatingCache();
  }
  if(activeHoverId===movie.id){
    const badge=$('#hover-age-rating');
    if(badge){
      badge.textContent=clean;
      badge.hidden=false;
    }
  }
  if(heroMovies[heroIndex]?.id===movie.id){
    const hBadge=$('#hero-age-rating');
    if(hBadge){
      hBadge.textContent=clean;
      hBadge.hidden=false;
    }
  }
}

function persistLogoCache(){
  try{
    const obj={};
    for(const [k,v] of logoUrlCache.entries())obj[k]=v;
    sessionStorage.setItem('moviebox-logos-v1',JSON.stringify(obj));
  }catch{}
}

function getMovieLogo(movie){
  if(!movie)return '';
  if(movie.logo){
    if(!logoUrlCache.has(movie.id))logoUrlCache.set(movie.id,movie.logo);
    return movie.logo;
  }
  return logoUrlCache.get(movie.id)||'';
}

function applyLogoToElement(el,logoUrl,title){
  if(!el||!logoUrl)return;
  if(el.querySelector('.nf-card-logo'))return;
  const titleNode=el.querySelector('.nf-card-title');
  const img=document.createElement('img');
  img.className='nf-card-logo';
  img.src=logoUrl;
  img.alt=title||'';
  img.loading='lazy';
  img.onload=()=>{
    if(titleNode)titleNode.hidden=true;
  };
  img.onerror=()=>{
    img.remove();
    if(titleNode)titleNode.hidden=false;
  };
  el.appendChild(img);
}

async function hydrateLogosForMovies(list){
  const missing=[];
  const seen=new Set();
  for(const m of list||[]){
    if(!m||!m.tmdbId||!m.id)continue;
    if(seen.has(m.id)||logoFetchedIds.has(m.id)||getMovieLogo(m))continue;
    seen.add(m.id);
    missing.push(m);
  }
  if(!missing.length)return;
  missing.forEach(m=>logoFetchedIds.add(m.id));

  const chunkSize=24;
  for(let i=0;i<missing.length;i+=chunkSize){
    const chunk=missing.slice(i,i+chunkSize);
    const query=chunk.map(m=>`${m.mediaType==='tv'?'tv':'movie'}:${m.tmdbId}`).join(',');
    try{
      const res=await fetch(`/api/logos?items=${encodeURIComponent(query)}`);
      if(!res.ok)continue;
      const data=await res.json();
      const map=data?.logos||{};
      let updated=false;
      for(const m of chunk){
        const url=map[m.id]||'';
        if(url){
          m.logo=url;
          logoUrlCache.set(m.id,url);
          updated=true;
          $$(`.nf-card[data-id="${CSS.escape(m.id)}"]`).forEach(el=>applyLogoToElement(el,url,m.title));
          if(heroMovies[heroIndex]?.id===m.id){
            setHeroMovie(heroIndex);
          }
        }
      }
      if(updated)persistLogoCache();
    }catch{}
  }
}

function optimizeTmdbImg(url,size){
  if(!url||!url.includes('image.tmdb.org/t/p/'))return url||'';
  return url.replace(/\/t\/p\/w\d+\//,`/t/p/${size}/`);
}

function renderLandscapeCard(movie,index,rowId,{showProgress=false}={}){
  const rawImg=movie.backdrop||movie.poster||'';
  const img=optimizeTmdbImg(rawImg,'w780');
  const rawLogo=getMovieLogo(movie);
  const logo=optimizeTmdbImg(rawLogo,'w300');
  const pct=showProgress?(progress[movie.id]?.pct||0):0;
  const badge=showProgress?'':getCardBadge(movie,index,rowId);
  const showMono=movie.mediaType==='tv'||index%2===0;
  return `<article class="nf-card ${badge?'has-badge':''}" data-id="${escapeHtml(movie.id)}" tabindex="0" role="button" aria-label="${escapeHtml(movie.title)}">
    ${img?`<img class="nf-card-img" src="${escapeHtml(img)}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" />`:''}
    <div class="nf-card-scrim"></div>
    ${showMono?`<span class="nf-card-monogram" aria-hidden="true">M</span>`:''}
    ${logo?`<img class="nf-card-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" onerror="this.remove();this.nextElementSibling&&(this.nextElementSibling.hidden=false)" />`:''}
    <h3 class="nf-card-title" ${logo?'hidden':''}>${escapeHtml(movie.title)}</h3>
    ${badge?`<span class="nf-card-badge">${escapeHtml(badge)}</span>`:''}
    ${pct>0?`<div class="nf-card-progress"><div class="nf-card-progress-fill" style="width:${pct}%"></div></div>`:''}
  </article>`;
}

function renderTop10Card(movie,rank,rowId){
  const rawImg=movie.poster||movie.backdrop||'';
  const img=optimizeTmdbImg(rawImg,'w342');
  const badge=getCardBadge(movie,rank-1,rowId);
  const isTen=rank>=10;
  return `<article class="nf-top10-card">
    <svg class="nf-top10-rank" viewBox="${isTen?'0 0 155 210':'0 0 105 210'}" preserveAspectRatio="none" aria-hidden="true">
      <text x="${isTen?'72':'52'}" y="198" text-anchor="middle" font-size="${isTen?'212':'246'}" letter-spacing="${isTen?'-18':'-4'}">${rank}</text>
    </svg>
    <div class="nf-top10-poster" data-id="${escapeHtml(movie.id)}" tabindex="0" role="button" aria-label="Number ${rank}: ${escapeHtml(movie.title)}">
      ${img?`<img src="${escapeHtml(img)}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" />`:''}
      ${badge?`<span class="nf-card-badge">${escapeHtml(badge)}</span>`:''}
    </div>
  </article>`;
}

function renderNetflixRow({id,title,items,type='landscape',showProgress=false}){
  const unique=getUniqueMovies(items);
  if(!unique.length)return '';
  const rowCap=document.body.classList.contains('vidaa-tv')?12:18;
  const list=type==='top10'?unique.slice(0,10):unique.slice(0,rowCap);
  const cardsHtml=type==='top10'
    ? list.map((m,i)=>renderTop10Card(m,i+1,id)).join('')
    : list.map((m,i)=>renderLandscapeCard(m,i,id,{showProgress})).join('');
  return `<section class="nf-row-section" id="row-${escapeHtml(id)}">
    <div class="nf-row-header"><h2 class="nf-row-title">${escapeHtml(title)}</h2></div>
    <div class="nf-row-viewport">
      <button type="button" class="nf-row-arrow prev" data-dir="-1" aria-label="Scroll left">${SVG_CHEVRON_LEFT}</button>
      <div class="nf-row-track ${type==='top10'?'is-top10':''}">${cardsHtml}</div>
      <button type="button" class="nf-row-arrow next" data-dir="1" aria-label="Scroll right">${SVG_CHEVRON_RIGHT}</button>
    </div>
  </section>`;
}

function buildHomeRows(filtered,watching){
  const savedList=getUniqueMovies([...saved].map(id=>findMovieById(id)).filter(Boolean));
  const hs=homeShelves||{};

  if(currentView==='tv'){
    const tvOnly=filtered.filter(m=>isTvSeries(m));
    const savedTv=savedList.filter(m=>isTvSeries(m));
    const watchingTv=watching.filter(m=>isTvSeries(m));
    const rows=[
      {id:'top-picks',title:'Trending Series Now',items:(hs.mode==='tv'&&hs.topPicks?.length?hs.topPicks:tvOnly),type:'landscape'},
      ...(savedTv.length?[{id:'my-list',title:'My Series List',items:savedTv,type:'landscape'}]:[]),
      {id:'top10-series',title:'Top 10 Series Today',items:(hs.mode==='tv'&&hs.top10Series?.length?hs.top10Series:tvOnly).slice(0,10),type:'top10'},
      {id:'bingeworthy-tv',title:'On the Air & Bingeworthy',items:(hs.mode==='tv'&&hs.bingeworthyTv?.length?hs.bingeworthyTv:tvOnly.slice(4)),type:'landscape'},
      ...(watchingTv.length?[{id:'continue-watching',title:'Continue Watching',items:watchingTv,type:'landscape',showProgress:true}]:[]),
      ...(hs.mode==='tv'&&hs.ominousDrama?.length?[{id:'ominous-drama',title:'Crime & Mystery Series',items:hs.ominousDrama,type:'landscape'}]:[]),
      ...(hs.mode==='tv'&&hs.sciFiFantasy?.length?[{id:'scifi-tv',title:'Sci-Fi & Fantasy Series',items:hs.sciFiFantasy,type:'landscape'}]:[]),
      ...(hs.mode==='tv'&&hs.actionAdventure?.length?[{id:'action-tv',title:'Action & Adventure Series',items:hs.actionAdventure,type:'landscape'}]:[]),
      ...(hs.mode==='tv'&&hs.comedy?.length?[{id:'comedy-tv',title:'Comedy Series',items:hs.comedy,type:'landscape'}]:[]),
      {id:'rewatch-favorites',title:'Critically Acclaimed Series',items:(hs.mode==='tv'&&hs.rewatchFavorites?.length?hs.rewatchFavorites:[...tvOnly].reverse()),type:'landscape'}
    ];
    return rows.filter(r=>r.items&&r.items.length).map(renderNetflixRow).join('');
  }

  if(currentView==='movies'){
    const moviesOnly=filtered.filter(m=>!isTvSeries(m));
    const savedMovies=savedList.filter(m=>!isTvSeries(m));
    const watchingMovies=watching.filter(m=>!isTvSeries(m));
    const rows=[
      {id:'top-picks',title:'Trending Films Now',items:(hs.mode==='movie'&&hs.topPicks?.length?hs.topPicks:moviesOnly),type:'landscape'},
      ...(savedMovies.length?[{id:'my-list',title:'My Films List',items:savedMovies,type:'landscape'}]:[]),
      {id:'top10-films',title:'Top 10 Films Today',items:(hs.mode==='movie'&&hs.top10Films?.length?hs.top10Films:moviesOnly).slice(0,10),type:'top10'},
      ...(hs.mode==='movie'&&hs.newReleases?.length?[{id:'new-releases',title:'Now Playing & New Releases',items:hs.newReleases,type:'landscape'}]:[]),
      ...(watchingMovies.length?[{id:'continue-watching',title:'Continue Watching',items:watchingMovies,type:'landscape',showProgress:true}]:[]),
      {id:'adrenaline-movies',title:'Adrenaline Rush Movies',items:(hs.mode==='movie'&&hs.adrenalineMovies?.length?hs.adrenalineMovies:moviesOnly.slice(4)),type:'landscape'},
      ...(hs.mode==='movie'&&hs.crimeMystery?.length?[{id:'crime-mystery',title:'Crime, Mystery & Thrillers',items:hs.crimeMystery,type:'landscape'}]:[]),
      ...(hs.mode==='movie'&&hs.sciFiFantasy?.length?[{id:'scifi-movies',title:'Sci-Fi & Fantasy Films',items:hs.sciFiFantasy,type:'landscape'}]:[]),
      ...(hs.mode==='movie'&&hs.comedy?.length?[{id:'comedy-movies',title:'Comedy Films',items:hs.comedy,type:'landscape'}]:[]),
      {id:'rewatch-favorites',title:'Critically Acclaimed Films',items:(hs.mode==='movie'&&hs.rewatchFavorites?.length?hs.rewatchFavorites:[...moviesOnly].reverse()),type:'landscape'}
    ];
    return rows.filter(r=>r.items&&r.items.length).map(renderNetflixRow).join('');
  }

  const fallbackTv=filtered.filter(m=>m.mediaType==='tv');
  const fallbackMovies=filtered.filter(m=>m.mediaType!=='tv');

  const topPicks=(hs.topPicks?.length?hs.topPicks:filtered).slice(0,18);
  const top10Series=(hs.top10Series?.length?hs.top10Series:(fallbackTv.length?fallbackTv:filtered)).slice(0,10);
  const bingeworthyTv=(hs.bingeworthyTv?.length?hs.bingeworthyTv:fallbackTv.slice(4)).slice(0,18);
  const top10Films=(hs.top10Films?.length?hs.top10Films:(fallbackMovies.length?fallbackMovies:filtered)).slice(0,10);
  const adrenalineMovies=(hs.adrenalineMovies?.length?hs.adrenalineMovies:fallbackMovies.slice(4)).slice(0,18);
  const ominousDrama=(hs.ominousDrama?.length?hs.ominousDrama:fallbackTv).slice(0,18);
  const newReleases=(hs.newReleases?.length?hs.newReleases:(recentCatalog.length?recentCatalog:filtered)).slice(0,18);
  const rewatchFavorites=(hs.rewatchFavorites?.length?hs.rewatchFavorites:[...filtered].reverse()).slice(0,18);
  const crimeMystery=(hs.crimeMystery?.length?hs.crimeMystery:fallbackMovies).slice(0,18);

  const rows=[
    {id:'top-picks',title:"Today's Top Picks for You",items:topPicks,type:'landscape'},
    ...(savedList.length?[{id:'my-list',title:'My List',items:savedList,type:'landscape'}]:[]),
    ...(top10Series.length?[{id:'top10-series',title:'Top 10 Series Today',items:top10Series,type:'top10'}]:[]),
    ...(bingeworthyTv.length?[{id:'bingeworthy-tv',title:'Bingeworthy TV Thrillers',items:bingeworthyTv,type:'landscape'}]:[]),
    ...(top10Films.length?[{id:'top10-films',title:'Top 10 Films Today',items:top10Films,type:'top10'}]:[]),
    ...(watching.length?[{id:'continue-watching',title:'Continue Watching',items:watching,type:'landscape',showProgress:true}]:[]),
    ...(adrenalineMovies.length?[{id:'adrenaline-movies',title:'Adrenaline Rush Movies',items:adrenalineMovies,type:'landscape'}]:[]),
    ...(ominousDrama.length?[{id:'ominous-drama',title:'Ominous Drama Series',items:ominousDrama,type:'landscape'}]:[]),
    ...(newReleases.length?[{id:'new-releases',title:'New on MovieBox',items:newReleases,type:'landscape'}]:[]),
    ...(rewatchFavorites.length?[{id:'rewatch-favorites',title:'Critically Acclaimed & Rewatch Favorites',items:rewatchFavorites,type:'landscape'}]:[]),
    ...(crimeMystery.length?[{id:'crime-mystery',title:'Crime, Mystery & Thrillers',items:crimeMystery,type:'landscape'}]:[])
  ];
  return rows.map(renderNetflixRow).join('');
}

const SVG_VOLUME_OFF=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
const SVG_VOLUME_ON=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;

const TRAILER_STORAGE_KEY='moviebox-trailers-v2';
const trailerKeysCache=new Map();
const verifiedTrailerKey=new Map();
const failedTrailerKeys=new Set();
const pendingTrailerFetches=new Map();
let hoverPreviewMuted=true;
let activeHoverContext=null;

try{
  const savedTrailers=JSON.parse(localStorage.getItem(TRAILER_STORAGE_KEY)||'{}');
  for(const [k,v] of Object.entries(savedTrailers)){
    if(typeof v==='string'&&v)verifiedTrailerKey.set(k,v);
  }
}catch{}

function persistVerifiedTrailers(){
  try{
    const obj={};
    for(const [k,v] of verifiedTrailerKey.entries()){
      if(v)obj[k]=v;
    }
    localStorage.setItem(TRAILER_STORAGE_KEY,JSON.stringify(obj));
  }catch{}
}

async function getTrailerCandidates(movie){
  if(!movie||!movie.tmdbId)return [];
  const type=isTvSeries(movie)?'tv':'movie';
  const cacheKey=`${type}-${movie.tmdbId}`;
  const persisted=verifiedTrailerKey.get(cacheKey);
  if(persisted&&!failedTrailerKeys.has(persisted)){
    const extra=(trailerKeysCache.get(cacheKey)||[]).filter(k=>k!==persisted&&!failedTrailerKeys.has(k));
    return [persisted,...extra];
  }
  if(trailerKeysCache.has(cacheKey)){
    return trailerKeysCache.get(cacheKey).filter(k=>!failedTrailerKeys.has(k));
  }
  if(pendingTrailerFetches.has(cacheKey))return pendingTrailerFetches.get(cacheKey);
  const p=(async()=>{
    try{
      let r=await fetch(`/api/title/${type}/${movie.tmdbId}`);
      if(!r.ok)r=await fetch(`/api/title?type=${type}&id=${movie.tmdbId}`);
      if(!r.ok)return [];
      const d=await r.json();
      if(d?.ageRating)setMovieAgeRating(movie,d.ageRating);
      const videos=Array.isArray(d?.videos?.results)?d.videos.results:[];
      const yt=videos.filter(v=>v&&v.site==='YouTube'&&v.key);
      yt.sort((a,b)=>{
        const score=v=>{
          const sz=Number(v.size)||0;
          const hdScore=sz>=1080?12:(sz>=720?6:0);
          const langScore=v.iso_639_1==='en'?6:0;
          const typeScore=v.type==='Trailer'?5:v.type==='Teaser'?4:v.type==='Clip'?3:v.type==='Opening Credits'?2:1;
          const offScore=v.official?2:0;
          return hdScore+langScore+typeScore+offScore;
        };
        return score(b)-score(a);
      });
      const keys=[...new Set(yt.map(v=>v.key))];
      if(keys.length)trailerKeysCache.set(cacheKey,keys);
      return keys.filter(k=>!failedTrailerKeys.has(k));
    }catch{
      return [];
    }finally{
      pendingTrailerFetches.delete(cacheKey);
    }
  })();
  pendingTrailerFetches.set(cacheKey,p);
  return p;
}

function sendYtCommand(iframe,func,args=[]){
  if(!iframe?.contentWindow)return;
  try{
    iframe.contentWindow.postMessage(JSON.stringify({event:'command',func,args}),'*');
  }catch{}
}

let hoverTimer=null,hoverLeaveTimer=null,activeHoverId=null,activePreviewCard=null;
function hideHoverCard(){
  clearTimeout(hoverTimer);
  clearTimeout(hoverLeaveTimer);
  activeHoverId=null;
  activeHoverContext=null;
  if(activePreviewCard){
    activePreviewCard.classList.remove('is-previewing');
    activePreviewCard.querySelector('.nf-inline-preview')?.remove();
    activePreviewCard.querySelector('.nf-inline-mute')?.remove();
    activePreviewCard.querySelector('.nf-card-img, .nf-top10-poster img')?.classList.remove('ken-burns');
    activePreviewCard=null;
  }
  if(activeHeroContext?.iframe&&!$('#hero-section')?.hidden&&window.scrollY<520){
    sendYtCommand(activeHeroContext.iframe,'playVideo');
  }
}

function mountHoverTrailer(ctx){
  if(!ctx||activeHoverId!==ctx.id||activePreviewCard!==ctx.cardEl)return;
  const {wrap,muteBtn,backdropImg,movie,keys}=ctx;
  while(ctx.index<keys.length&&failedTrailerKeys.has(keys[ctx.index])){
    ctx.index++;
  }
  const key=keys[ctx.index];
  if(!key){
    wrap.innerHTML='';
    wrap.classList.remove('ready');
    if(muteBtn)muteBtn.hidden=true;
    backdropImg?.classList.add('ken-burns');
    return;
  }

  wrap.innerHTML='';
  wrap.classList.remove('ready');
  const mutedParam=hoverPreviewMuted?1:0;
  const originParam=encodeURIComponent(window.location.origin);
  const iframe=document.createElement('iframe');
  iframe.className='nf-inline-video';
  iframe.title=`${movie.title} 1080p HD preview`;
  iframe.allow='autoplay; encrypted-media; picture-in-picture';
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  iframe.src=`https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&mute=${mutedParam}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&loop=1&playlist=${encodeURIComponent(key)}&enablejsapi=1&vq=hd1080&hd=1&origin=${originParam}`;
  ctx.iframe=iframe;
  ctx.currentKey=key;
  ctx.started=false;

  iframe.onload=()=>{
    if(activeHoverId!==ctx.id||ctx.iframe!==iframe)return;
    try{
      iframe.contentWindow?.postMessage(JSON.stringify({event:'listening',id:ctx.id}),'*');
    }catch{}
    sendYtCommand(iframe,'setPlaybackQuality',['hd1080']);
    sendYtCommand(iframe,'setPlaybackQualityRange',['hd1080','hd1080']);
    sendYtCommand(iframe,'playVideo');
    if(hoverPreviewMuted)sendYtCommand(iframe,'mute');
    else sendYtCommand(iframe,'unMute');
    setTimeout(()=>{
      if(activeHoverId===ctx.id&&ctx.iframe===iframe&&!failedTrailerKeys.has(key)){
        wrap.classList.add('ready');
      }
    },80);
  };

  wrap.appendChild(iframe);

  if(muteBtn){
    muteBtn.hidden=false;
    muteBtn.onclick=e=>{
      e.stopPropagation();
      hoverPreviewMuted=!hoverPreviewMuted;
      muteBtn.innerHTML=hoverPreviewMuted?SVG_VOLUME_OFF:SVG_VOLUME_ON;
      muteBtn.setAttribute('aria-label',hoverPreviewMuted?'Unmute preview':'Mute preview');
      muteBtn.title=hoverPreviewMuted?'Unmute':'Mute';
      sendYtCommand(iframe,hoverPreviewMuted?'mute':'unMute');
    };
  }
}

let heroPreviewMuted=true;
let activeHeroContext=null;
let heroPreviewDelayTimer=null;

function stopHeroPreview(){
  clearTimeout(heroPreviewDelayTimer);
  activeHeroContext=null;
  const wrap=$('#hero-video-wrap');
  const muteBtn=$('#hero-mute-btn');
  if(wrap){
    wrap.classList.remove('ready');
    wrap.innerHTML='';
  }
  if(muteBtn)muteBtn.hidden=true;
}

function mountHeroTrailer(ctx){
  if(!ctx||activeHeroContext!==ctx)return;
  const heroSec=$('#hero-section');
  if(!heroSec||heroSec.hidden){stopHeroPreview();return}
  const {wrap,muteBtn,movie,keys}=ctx;
  while(ctx.index<keys.length&&failedTrailerKeys.has(keys[ctx.index])){
    ctx.index++;
  }
  const key=keys[ctx.index];
  if(!key){
    wrap.innerHTML='';
    wrap.classList.remove('ready');
    if(muteBtn)muteBtn.hidden=true;
    return;
  }

  wrap.innerHTML='';
  wrap.classList.remove('ready');
  const mutedParam=heroPreviewMuted?1:0;
  const originParam=encodeURIComponent(window.location.origin);
  const iframe=document.createElement('iframe');
  iframe.className='hero-video-frame';
  iframe.title=`${movie.title} 1080p HD hero preview`;
  iframe.allow='autoplay; encrypted-media; picture-in-picture';
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  iframe.src=`https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&mute=${mutedParam}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&loop=1&playlist=${encodeURIComponent(key)}&enablejsapi=1&vq=hd1080&hd=1&origin=${originParam}`;
  ctx.iframe=iframe;
  ctx.currentKey=key;
  ctx.started=false;

  iframe.onload=()=>{
    if(activeHeroContext!==ctx||ctx.iframe!==iframe)return;
    try{
      iframe.contentWindow?.postMessage(JSON.stringify({event:'listening',id:`hero-${ctx.id}`}),'*');
    }catch{}
    sendYtCommand(iframe,'setPlaybackQuality',['hd1080']);
    sendYtCommand(iframe,'setPlaybackQualityRange',['hd1080','hd1080']);
    if(activeHoverId){
      sendYtCommand(iframe,'pauseVideo');
    }else{
      sendYtCommand(iframe,'playVideo');
    }
    if(heroPreviewMuted)sendYtCommand(iframe,'mute');
    else sendYtCommand(iframe,'unMute');
    setTimeout(()=>{
      if(activeHeroContext===ctx&&ctx.iframe===iframe&&!failedTrailerKeys.has(key)){
        wrap.classList.add('ready');
      }
    },150);
  };

  wrap.appendChild(iframe);

  if(muteBtn){
    muteBtn.hidden=false;
    muteBtn.innerHTML=heroPreviewMuted?SVG_VOLUME_OFF:SVG_VOLUME_ON;
    muteBtn.setAttribute('aria-label',heroPreviewMuted?'Unmute hero preview':'Mute hero preview');
    muteBtn.title=heroPreviewMuted?'Unmute':'Mute';
    muteBtn.onclick=e=>{
      e.stopPropagation();
      heroPreviewMuted=!heroPreviewMuted;
      muteBtn.innerHTML=heroPreviewMuted?SVG_VOLUME_OFF:SVG_VOLUME_ON;
      muteBtn.setAttribute('aria-label',heroPreviewMuted?'Unmute hero preview':'Mute hero preview');
      muteBtn.title=heroPreviewMuted?'Unmute':'Mute';
      sendYtCommand(iframe,heroPreviewMuted?'mute':'unMute');
    };
  }
}

function scheduleHeroPreview(movie){
  stopHeroPreview();
  if(document.body.classList.contains('vidaa-tv'))return;
  const heroSec=$('#hero-section');
  const wrap=$('#hero-video-wrap');
  const muteBtn=$('#hero-mute-btn');
  if(!movie||!movie.tmdbId||!wrap||!heroSec||heroSec.hidden)return;
  const isTV=isTvSeries(movie);
  const cacheKey=`${isTV?'tv':'movie'}-${movie.tmdbId}`;
  const reqId=movie.id;
  heroPreviewDelayTimer=setTimeout(()=>{
    if(heroMovies[heroIndex]?.id!==reqId||heroSec.hidden)return;
    getTrailerCandidates(movie).then(keys=>{
      if(heroMovies[heroIndex]?.id!==reqId||heroSec.hidden||!keys.length)return;
      const ctx={id:reqId,wrap,muteBtn,movie,keys,cacheKey,index:0,iframe:null,currentKey:'',started:false,isHero:true};
      activeHeroContext=ctx;
      mountHeroTrailer(ctx);
    });
  },150);
}

window.addEventListener('message',event=>{
  const isHoverSource=Boolean(activeHoverContext?.iframe&&event.source===activeHoverContext.iframe.contentWindow);
  const isHeroSource=Boolean(activeHeroContext?.iframe&&event.source===activeHeroContext.iframe.contentWindow);
  const isModalSource=Boolean(activeModalContext?.iframe&&event.source===activeModalContext.iframe.contentWindow);
  if(!isHoverSource&&!isHeroSource&&!isModalSource)return;
  let data=event.data;
  if(typeof data==='string'){
    try{data=JSON.parse(data)}catch{return}
  }
  if(!data)return;
  const ctx=isModalSource?activeModalContext:(isHoverSource?activeHoverContext:activeHeroContext);
  if(data.event==='onError'){
    if(ctx.currentKey)failedTrailerKeys.add(ctx.currentKey);
    if(verifiedTrailerKey.get(ctx.cacheKey)===ctx.currentKey){
      verifiedTrailerKey.delete(ctx.cacheKey);
      persistVerifiedTrailers();
    }
    ctx.index++;
    if(ctx.isModal)mountModalTrailer(ctx);
    else if(ctx.isHero)mountHeroTrailer(ctx);
    else mountHoverTrailer(ctx);
    return;
  }
  const state=data.event==='onStateChange'?data.info:data?.info?.playerState;
  if(state===1){
    ctx.started=true;
    ctx.wrap.classList.add('ready');
    sendYtCommand(ctx.iframe,'setPlaybackQuality',['hd1080']);
    if(ctx.currentKey&&verifiedTrailerKey.get(ctx.cacheKey)!==ctx.currentKey){
      verifiedTrailerKey.set(ctx.cacheKey,ctx.currentKey);
      persistVerifiedTrailers();
    }
  }
});

function showHoverCardFor(cardEl){
  if(window.innerWidth<768||document.body.classList.contains('vidaa-tv'))return;
  if(!cardEl||activePreviewCard===cardEl)return;
  const id=cardEl.dataset?.id;
  const movie=findMovieById(id);
  if(!movie)return;

  hideHoverCard();
  if(activeHeroContext?.iframe)sendYtCommand(activeHeroContext.iframe,'pauseVideo');

  activeHoverId=id;
  activePreviewCard=cardEl;
  cardEl.classList.add('is-previewing');

  const container=cardEl.querySelector('.nf-top10-poster')||cardEl;
  const backdropImg=container.querySelector('.nf-card-img, img');

  const wrap=document.createElement('div');
  wrap.className='nf-inline-preview';
  container.appendChild(wrap);

  const muteBtn=document.createElement('button');
  muteBtn.type='button';
  muteBtn.className='nf-inline-mute';
  muteBtn.hidden=true;
  muteBtn.innerHTML=hoverPreviewMuted?SVG_VOLUME_OFF:SVG_VOLUME_ON;
  muteBtn.setAttribute('aria-label',hoverPreviewMuted?'Unmute preview':'Mute preview');
  muteBtn.title=hoverPreviewMuted?'Unmute':'Mute';
  container.appendChild(muteBtn);

  const isTV=isTvSeries(movie);
  if(movie.tmdbId){
    const cacheKey=`${isTV?'tv':'movie'}-${movie.tmdbId}`;
    getTrailerCandidates(movie).then(keys=>{
      if(activeHoverId!==id||activePreviewCard!==cardEl)return;
      if(!keys.length){
        backdropImg?.classList.add('ken-burns');
        return;
      }
      const ctx={id,cardEl,wrap,muteBtn,backdropImg,movie,keys,cacheKey,index:0,iframe:null,currentKey:'',started:false};
      activeHoverContext=ctx;
      mountHoverTrailer(ctx);
    });
  }else{
    backdropImg?.classList.add('ken-burns');
  }
}

(function initHoverPopoverListeners(){
  let heroScrollTimer=null;
  let heroPausedByScroll=false;
  window.addEventListener('scroll',()=>{
    if(activeHoverId)hideHoverCard();
    clearTimeout(heroScrollTimer);
    heroScrollTimer=setTimeout(()=>{
      if(!activeHeroContext?.iframe||$('#hero-section')?.hidden)return;
      const pastHero=window.scrollY>520;
      if(pastHero&&!heroPausedByScroll){
        heroPausedByScroll=true;
        sendYtCommand(activeHeroContext.iframe,'pauseVideo');
      }else if(!pastHero&&heroPausedByScroll&&!activeHoverId){
        heroPausedByScroll=false;
        sendYtCommand(activeHeroContext.iframe,'playVideo');
      }
    },150);
  },{passive:true});
})();

function bindHomeRows(){
  $$('.nf-row-arrow').forEach(btn=>{
    btn.onclick=()=>{
      const track=btn.parentElement?.querySelector('.nf-row-track');
      if(!track)return;
      const dir=Number(btn.dataset.dir)||1;
      const amount=Math.max(300,track.clientWidth*0.82);
      track.scrollBy({left:dir*amount,behavior:'smooth'});
    };
  });

  $$('.nf-card').forEach(el=>{
    const open=()=>{
      hideHoverCard();
      const movie=findMovieById(el.dataset.id);
      if(movie)openDetailPage(movie,{autoplay:true});
    };
    el.onclick=open;
    el.onkeydown=evt=>{
      if(evt.key==='Enter'||evt.key===' '){
        evt.preventDefault();
        open();
      }
    };
    el.onmouseenter=()=>{
      clearTimeout(hoverLeaveTimer);
      clearTimeout(hoverTimer);
      // 140ms settle avoids spawning wasted YouTube iframes while gliding across cards
      hoverTimer=setTimeout(()=>showHoverCardFor(el),140);
    };
    el.onfocus=()=>{
      if(window.innerWidth<768)return;
      clearTimeout(hoverLeaveTimer);
      clearTimeout(hoverTimer);
      hoverTimer=setTimeout(()=>showHoverCardFor(el),180);
    };
    el.onmouseleave=()=>{
      clearTimeout(hoverTimer);
      clearTimeout(hoverLeaveTimer);
      hoverLeaveTimer=setTimeout(hideHoverCard,120);
    };
    el.onblur=()=>{
      clearTimeout(hoverTimer);
      clearTimeout(hoverLeaveTimer);
      hoverLeaveTimer=setTimeout(()=>{
        if(!el.contains(document.activeElement))hideHoverCard();
      },120);
    };
  });

  // Top 10: focus & click snap strictly onto the poster card only (no rank number snap, no preview video)
  $$('.nf-top10-poster').forEach(el=>{
    const open=()=>{
      hideHoverCard();
      const movie=findMovieById(el.dataset.id);
      if(movie)openDetailPage(movie,{autoplay:true});
    };
    el.onclick=open;
    el.onkeydown=evt=>{
      if(evt.key==='Enter'||evt.key===' '){
        evt.preventDefault();
        open();
      }
    };
    el.onmouseenter=()=>hideHoverCard();
    el.onfocus=()=>hideHoverCard();
  });
}

function switchView(viewName){
  hideHoverCard();
  if(viewName!=='detail')stopPlayer();
  currentView=viewName;
  $$('.main-nav .nav-link').forEach(link=>{
    const isThis=link.dataset.view===viewName||(viewName==='home'&&(link.dataset.view==='home'||link.getAttribute('href')==='#home'));
    link.classList.toggle('active',isThis);
  });
  const hero=$('#hero-section'),discover=$('#discover'),homeShelvesEl=$('#home-shelves'),results=$('#results-section'),myList=$('#my-list-section'),detailPage=$('#detail-page');
  if(viewName==='detail'){
    stopHeroPreview();
    if(hero)hero.hidden=true;
    if(discover)discover.hidden=true;
    if(homeShelvesEl)homeShelvesEl.hidden=true;
    if(results)results.hidden=true;
    if(myList)myList.hidden=true;
    if(detailPage)detailPage.hidden=false;
    window.scrollTo({top:0,behavior:'auto'});
    return;
  }
  if(detailPage)detailPage.hidden=true;
  if(viewName==='saved'){
    stopHeroPreview();
    if(hero)hero.hidden=true;
    if(discover)discover.hidden=true;
    if(homeShelvesEl)homeShelvesEl.hidden=true;
    if(results)results.hidden=true;
    if(myList)myList.hidden=false;
    renderMyList();
    window.scrollTo({top:0,behavior:'smooth'});
  }else{
    if(myList)myList.hidden=true;
    if(viewName==='home'||viewName==='tv'||viewName==='movies'){
      if(hero)hero.hidden=false;
      if(discover)discover.hidden=true;
      const browseBtn=$('#nav-browse-btn');
      if(browseBtn)browseBtn.setAttribute('aria-expanded','false');
      isListView=false;
      recentListMode=false;
      homeMixedMode=(viewName==='home');
      if($('#genre-filter'))$('#genre-filter').value='all';
      if($('#year-filter'))$('#year-filter').value='all';
      if($('#sort-filter'))$('#sort-filter').value='featured';
      if(viewName==='tv'&&$('#media-type'))$('#media-type').value='tv';
      if(viewName==='movies'&&$('#media-type'))$('#media-type').value='movie';
      const targetMode=viewName==='tv'?'tv':(viewName==='movies'?'movie':'all');
      const needsFetch=currentPage!==1||(homeShelves?.mode!==targetMode);
      if(needsFetch){
        loadTMDBCatalog('',1).catch(()=>{});
      }else{
        setupHeroCarousel(catalog);
        render();
      }
      window.scrollTo({top:0,behavior:'smooth'});
    }else if(viewName==='recent'){
      stopHeroPreview();
      if(hero)hero.hidden=true;
      if(discover)discover.hidden=true;
      isListView=true;
      recentListMode=true;
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    }else if(viewName==='discover'){
      if(hero)hero.hidden=false;
      if(discover)discover.hidden=false;
      isListView=true;
      recentListMode=false;
      render();
      scrollToList();
    }else{
      if(hero)hero.hidden=false;
      render();
    }
  }
}

function card(movie){const pct=progress[movie.id]?.pct||0;const isTV=movie.mediaType==='tv';const tagHtml=movie.tag?`<span class="poster-tag">ORIGINAL</span>`:(isTV?`<span class="poster-tag tv-tag">SERIES</span>`:'');return `<article class="movie-card" data-id="${movie.id}" tabindex="0" role="button" aria-label="${escapeHtml(movie.title)}"><div class="poster"><div class="poster-art" style="background-image:url('${movie.poster}')"></div>${tagHtml}<div class="card-actions"><button class="save-card ${saved.has(movie.id)?'saved':''}" aria-label="${saved.has(movie.id)?'Remove from':'Add to'} My list" title="My list">${saved.has(movie.id)?SVG_HEART:SVG_PLUS}</button></div>${pct?`<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`:''}</div><div class="card-info"><p class="card-title">${escapeHtml(movie.title)}</p><div class="card-meta"><span>${movie.year||'Classic'}</span><span>·</span><span>${escapeHtml(movie.genre)}</span>${movie.rating?`<span class="card-rating">★ ${movie.rating.toFixed(1)}</span>`:''}</div></div></article>`}

function render(){
  if(currentView==='saved'){renderMyList();return}
  if(currentView==='detail')return;
  const filtered=getUniqueMovies(filteredMovies()),kind=homeMixedMode?'movies & TV shows':($('#media-type').value==='tv'?'series':'films');
  const watching=getUniqueMovies(
    Object.entries(progress)
      .filter(([,p])=>p&&p.pct>0&&p.pct<95)
      .sort((a,b)=>(b[1]?.updatedAt||0)-(a[1]?.updatedAt||0))
      .map(([id])=>findMovieById(id))
      .filter(Boolean)
  );
  const search=$('#search-input')?.value.trim(),hasFilter=$('#genre-filter').value!=='all'||$('#year-filter').value!=='all';
  const showAsList=isListView||Boolean(search)||hasFilter||currentPage>1;
  const homeShelvesEl=$('#home-shelves');
  const resultsSection=$('#results-section');
  const hero=$('#hero-section');

  if(showAsList){
    if(homeShelvesEl)homeShelvesEl.hidden=true;
    if(resultsSection){
      resultsSection.hidden=false;
      resultsSection.classList.toggle('standalone',Boolean(hero?.hidden));
    }
    if(recentListMode&&!search&&!hasFilter&&currentPage===1){
      const uniqueRecent=getUniqueMovies(recentCatalog.length?recentCatalog:catalog);
      $('#results-title').textContent='New & Popular';
      $('#results-count').textContent=`${uniqueRecent.length} ${uniqueRecent.length===1?'title':'titles'}`;
      $('#results-grid').innerHTML=uniqueRecent.map(card).join('');
    }else{
      const found=search?catalog.filter(m=>`${m.title} ${m.genre} ${m.year} ${m.description}`.toLowerCase().includes(search.toLowerCase())):filtered;
      const uniqueFound=getUniqueMovies(found);
      $('#results-title').textContent=search?`Results for “${search}”`:hasFilter?`Filtered ${kind}${totalPages>1?` · Page ${currentPage}`:''}`:`All ${kind}${totalPages>1?` · Page ${currentPage}`:''}`;
      $('#results-count').textContent=totalPages>1?`${totalResults.toLocaleString()} titles · Page ${currentPage} of ${totalPages}`:`${uniqueFound.length} ${uniqueFound.length===1?'title':'titles'}`;
      $('#results-grid').innerHTML=uniqueFound.map(card).join('');
    }
    renderPagination();
    bindCards();
  }else{
    if(resultsSection)resultsSection.hidden=true;
    if(homeShelvesEl){
      homeShelvesEl.hidden=false;
      homeShelvesEl.innerHTML=buildHomeRows(filtered,watching);
    }
    bindHomeRows();
    const visibleHomeIds=[...new Set($$('#home-shelves .nf-card').map(el=>el.dataset.id))];
    const visibleHomeMovies=visibleHomeIds.map(id=>findMovieById(id)).filter(Boolean);
    hydrateLogosForMovies([...heroMovies,...visibleHomeMovies]);
    // Pre-warm trailer keys on desktop only (skipped on VIDAA TV for 60fps zero-lag scrolling)
    if(!document.body.classList.contains('vidaa-tv')){
      const toWarm=visibleHomeMovies.slice(0,8);
      setTimeout(()=>{
        toWarm.forEach(m=>{if(m&&m.tmdbId)getTrailerCandidates(m).catch(()=>{})});
      },600);
    }
  }
}
function renderPagination(){const nav=$('#pagination');if(!nav)return;nav.hidden=totalPages<=1;const start=Math.max(1,Math.min(currentPage-2,totalPages-4)),end=Math.min(totalPages,start+4);let html=`<button class="page-button" data-page="${currentPage-1}" ${currentPage===1?'disabled':''} aria-label="Previous page">${SVG_PREV}</button>`;for(let p=start;p<=end;p++)html+=`<button class="page-button ${p===currentPage?'current':''}" data-page="${p}" ${p===currentPage?'aria-current="page"':''}>${p}</button>`;html+=`<button class="page-button" data-page="${currentPage+1}" ${currentPage===totalPages?'disabled':''} aria-label="Next page">${SVG_NEXT}</button>`;nav.innerHTML=html;nav.querySelectorAll('[data-page]').forEach(b=>b.onclick=async()=>{const page=Number(b.dataset.page);if(page>=1&&page<=totalPages&&page!==currentPage){isListView=true;const q=searchInput?.value.trim()||'';await loadTMDBCatalog(q,page);scrollToList()}})}
function filteredMovies(){let list=[...catalog];const genre=$('#genre-filter').value,year=$('#year-filter').value,sort=$('#sort-filter').value;if(genre!=='all')list=list.filter(m=>(m.genres||m.genre.split(',').map(x=>x.trim())).some(g=>g.toLowerCase()===genre.toLowerCase()));if(year!=='all')list=list.filter(m=>String(m.year)===year);if(sort==='rating')list.sort((a,b)=>b.rating-a.rating);if(sort==='newest'){const maxYear=2026;list.sort((a,b)=>{const aOk=a.year>0&&a.year<=maxYear,bOk=b.year>0&&b.year<=maxYear;if(aOk!==bOk)return aOk?-1:1;return b.year-a.year})}if(sort==='az')list.sort((a,b)=>a.title.localeCompare(b.title));return list}
function refreshFilterOptions(){const g=$('#genre-filter'),y=$('#year-filter'),oldG=g.value,oldY=y.value;const genres=[...new Set(catalog.flatMap(m=>m.genres||m.genre.split(',').map(x=>x.trim())).filter(Boolean))];g.innerHTML='<option value="all">All genres</option>'+genres.sort().map(v=>`<option value="${v}">${v}</option>`).join('');y.innerHTML='<option value="all">Any year</option>'+[...new Set(catalog.map(m=>m.year).filter(Boolean))].sort((a,b)=>b-a).map(v=>`<option value="${v}">${v}</option>`).join('');g.value=[...g.options].some(o=>o.value===oldG)?oldG:'all';y.value=[...y.options].some(o=>o.value===oldY)?oldY:'all';}
function bindCards(){$$('.movie-card').forEach(el=>{const open=()=>{const id=el.dataset.id;const movie=findMovieById(id);if(movie)openDetailPage(movie,{autoplay:true})};el.onclick=open;el.onkeydown=evt=>{if(evt.key==='Enter'||evt.key===' '){evt.preventDefault();open()}};const saveBtn=el.querySelector('.save-card');if(saveBtn){saveBtn.onclick=e=>{e.stopPropagation();const movie=findMovieById(el.dataset.id);if(movie)toggleSavedTitle(movie)}}})}
async function ensureTvMetadata(movie){
  if(!movie||!movie.tmdbId)return movie;
  const isTV=isTvSeries(movie);
  if(!isTV)return movie;
  movie.mediaType='tv';
  if(Array.isArray(movie.seasons)&&movie.seasons.length>0&&Number(movie.numberOfSeasons)>0){
    return movie;
  }
  const key=movie.id||`tmdb-tv-${movie.tmdbId}`;
  if(pendingTvFetches.has(key)){
    return pendingTvFetches.get(key);
  }
  const p=(async()=>{
    try{
      let r=await fetch(`/api/title/tv/${movie.tmdbId}`);
      if(!r.ok)r=await fetch(`/api/title?type=tv&id=${movie.tmdbId}`);
      if(!r.ok)return movie;
      const d=await r.json();
      if(!d)return movie;
      movie.numberOfSeasons=d.number_of_seasons||(d.seasons?.filter(s=>s.season_number>0).length)||1;
      movie.numberOfEpisodes=d.number_of_episodes||24;
      movie.seasons=d.seasons||[];
      movie.lastEpisodeToAir=d.last_episode_to_air||null;
      movie.nextEpisodeToAir=d.next_episode_to_air||null;
      if(d.ageRating)setMovieAgeRating(movie,d.ageRating);
      if(d.aggregate_credits?.cast?.length){
        movie.cast=d.aggregate_credits.cast.slice(0,6).map(p=>p.name).filter(Boolean);
      }else if(d.credits?.cast?.length){
        movie.cast=d.credits.cast.slice(0,6).map(p=>p.name).filter(Boolean);
      }
      if(d.name)movie.title=d.name;
      if(d.overview)movie.description=d.overview;
      if(d.poster_path&&!movie.poster)movie.poster=`https://image.tmdb.org/t/p/w500${d.poster_path}`;
      if(d.backdrop_path&&!movie.backdrop)movie.backdrop=`https://image.tmdb.org/t/p/w1280${d.backdrop_path}`;
      if(d.genres?.length){
        movie.genres=d.genres.map(g=>g.name);
        movie.genre=movie.genres.join(', ');
      }
      const y=Number((d.first_air_date||'').slice(0,4));
      if(y)movie.year=y;
      movie.duration=`${movie.numberOfSeasons} ${movie.numberOfSeasons===1?'season':'seasons'} · ${movie.numberOfEpisodes} episodes`;
      titleMetaCache.set(key,{
        seasons:movie.seasons,
        numberOfSeasons:movie.numberOfSeasons,
        numberOfEpisodes:movie.numberOfEpisodes,
        seasonEpisodes:movie.seasonEpisodes||{},
        lastEpisodeToAir:movie.lastEpisodeToAir,
        nextEpisodeToAir:movie.nextEpisodeToAir,
        title:movie.title,
        description:movie.description,
        poster:movie.poster,
        backdrop:movie.backdrop,
        genre:movie.genre,
        genres:movie.genres,
        year:movie.year
      });
      return movie;
    }catch(err){
      console.warn('Failed to ensure TV metadata',err);
      return movie;
    }finally{
      pendingTvFetches.delete(key);
    }
  })();
  pendingTvFetches.set(key,p);
  return p;
}

function openDetailPage(movie,{autoplay=false,skipPush=false}={}){
  if(!movie)return;
  stopPlayer();
  activeMovie=movie;
  const isTV=isTvSeries(movie);
  if(isTV)movie.mediaType='tv';
  const targetHash=`#title/${encodeURIComponent(movie.id)}`;
  if(!skipPush&&window.location.hash!==targetHash){
    history.pushState({view:'detail',id:movie.id},'',targetHash);
  }
  const logoEl=$('#detail-logo'),titleEl=$('#detail-title');
  const applyDetailLogo=(url)=>{
    if(!logoEl||!titleEl)return;
    if(url){
      logoEl.src=url;logoEl.alt=movie.title;logoEl.hidden=false;titleEl.hidden=true;
      logoEl.onerror=()=>{logoEl.hidden=true;titleEl.hidden=false};
    }else{
      logoEl.hidden=true;logoEl.removeAttribute('src');titleEl.textContent=movie.title;titleEl.hidden=false;
    }
  };
  const existingLogo=getMovieLogo(movie);
  applyDetailLogo(existingLogo);
  if(!existingLogo&&movie.tmdbId){
    hydrateLogosForMovies([movie]).then(()=>{
      if(activeMovie?.id===movie.id){
        const loaded=getMovieLogo(movie);
        if(loaded)applyDetailLogo(loaded);
      }
    });
  }

  const renderDetailMeta=()=>{
    const metaEl=$('#detail-meta'),ageRow=$('#detail-age-row'),descEl=$('#detail-description');
    const genres=(movie.genres&&movie.genres.length?movie.genres:String(movie.genre||'').split(',').map(s=>s.trim())).filter(Boolean);
    const age=getMovieAgeRating(movie);
    const seasonsText=isTV&&movie.numberOfSeasons?`${movie.numberOfSeasons} ${movie.numberOfSeasons===1?'Season':'Seasons'}`:(movie.duration||'');
    if(metaEl){
      metaEl.innerHTML=`
        ${movie.year?`<span>${movie.year}</span>`:''}
        ${seasonsText?`<span>${escapeHtml(seasonsText)}</span>`:''}
        ${movie.rating?`<span class="match-score">★ ${movie.rating.toFixed(1)}</span>`:''}
        <span class="quality-pill">HD</span>
      `;
    }
    if(ageRow){
      if(age){
        ageRow.hidden=false;
        ageRow.innerHTML=`<span class="age-rating-pill">${escapeHtml(age)}</span><span>${escapeHtml(genres.slice(0,3).join(', '))}</span>`;
      }else{
        ageRow.hidden=true;
      }
    }
    if(descEl)descEl.textContent=movie.description||'';
    const gWrap=$('#detail-genres-wrap'),gEl=$('#detail-genres');
    if(gWrap&&gEl){gWrap.hidden=!genres.length;gEl.textContent=genres.join(', ')}
    const tEl=$('#detail-tags');
    if(tEl)tEl.textContent=isTV?'TV Series, Streaming in HD':'Feature Film, Streaming in HD';
    const cWrap=$('#detail-cast-wrap'),cEl=$('#detail-cast');
    if(cWrap&&cEl){
      const castArr=Array.isArray(movie.cast)?movie.cast:[];
      cWrap.hidden=!castArr.length;
      if(castArr.length)cEl.textContent=castArr.join(', ');
    }
  };
  renderDetailMeta();

  const bgUrl=movie.backdrop||movie.poster||'';
  const backdropEl=$('#detail-backdrop');
  if(backdropEl)backdropEl.style.backgroundImage=bgUrl?`linear-gradient(180deg, rgba(20,20,20,.25) 0%, rgba(20,20,20,.75) 55%, #141414 100%), url('${bgUrl}')`:'';
  const kickerEl=$('#detail-kicker');
  if(kickerEl)kickerEl.textContent='MOVIEBOX';
  const canPlay=Boolean(movie.videoUrl||(movie.source==='TMDB'&&movie.tmdbId));
  const play=$('#detail-play');
  const restartBtn=$('#detail-restart');
  play.disabled=!canPlay;

  const updatePlayButtons=()=>{
    const s=isTV?(detailSelectedSeason||Number(progress[movie.id]?.season)||1):1;
    const e=isTV?(progress[movie.id]?.episode||1):1;
    const prog=getResumeProgress(movie.id,isTV?s:undefined,isTV?e:undefined);
    const resumeTime=prog.time||0;
    if(canPlay){
      if(resumeTime>10){
        const timeLabel=formatTimestamp(resumeTime);
        play.innerHTML=`<span class="play-triangle">${SVG_PLAY}</span> Resume ${isTV?`S${s}:E${e} · `:''}${timeLabel}`;
        play.title=`Resume from ${timeLabel}`;
        if(restartBtn){
          restartBtn.hidden=false;
          restartBtn.onclick=()=>playMovie(movie,{season:s,episode:e,resetTime:true});
        }
      }else{
        play.innerHTML=`<span class="play-triangle">${SVG_PLAY}</span> Play ${isTV?`S${s}:E${e}`:''}`;
        play.title='Play';
        if(restartBtn)restartBtn.hidden=true;
      }
    }else{
      play.innerHTML='No stream linked';
      if(restartBtn)restartBtn.hidden=true;
    }
    play.onclick=()=>{
      if(canPlay){
        playMovie(movie,{season:s,episode:e});
      }
    };
  };

  updatePlayButtons();

  const saveBtn=$('#detail-save');
  const syncDetailSave=()=>{
    if(!saveBtn)return;
    const isS=saved.has(movie.id);
    saveBtn.classList.toggle('saved',isS);
    saveBtn.innerHTML=isS?SVG_CHECK:SVG_PLUS;
    saveBtn.title=isS?'In My List':'Add to My List';
  };
  syncDetailSave();
  if(saveBtn)saveBtn.onclick=()=>{toggleSavedTitle(movie);syncDetailSave()};
  switchView('detail');
  if(isTV){
    detailSelectedSeason=Number(progress[movie.id]?.season)||1;
    renderDetailSeasons(movie);
  }else{
    const sSec=$('#detail-seasons-section');
    if(sSec)sSec.hidden=true;
  }
  if(autoplay&&canPlay){
    playMovie(movie);
  }
  if(movie.source==='TMDB'){
    const fetchTitleInfo=async()=>{
      try{
        if(isTV){
          await ensureTvMetadata(movie);
          if(activeMovie?.id!==movie.id)return;
          updatePlayButtons();
          renderDetailSeasons(movie);
          renderDetailMeta();
        }else{
          let r=await fetch(`/api/title/movie/${movie.tmdbId}`);
          if(!r.ok)r=await fetch(`/api/title?type=movie&id=${movie.tmdbId}`);
          if(!r.ok)return;
          const d=await r.json();
          if(!d||activeMovie?.id!==movie.id)return;
          if(d.ageRating)setMovieAgeRating(movie,d.ageRating);
          movie.duration=d.runtime?`${Math.floor(d.runtime/60)}h ${d.runtime%60}m`:'';
          movie.genres=(d.genres||[]).map(g=>g.name);
          movie.genre=movie.genres.join(', ')||movie.genre;
          if(d.overview)movie.description=d.overview;
          if(d.credits?.cast?.length){
            movie.cast=d.credits.cast.slice(0,6).map(p=>p.name).filter(Boolean);
          }
          renderDetailMeta();
        }
      }catch{}
    };
    fetchTitleInfo();
  }
}
let lastProgressSave=0;
let detailSelectedSeason=1;

function getAvailableSeasons(movie){
  if(!movie)return [];
  const seasonsMap=new Map();
  if(Array.isArray(movie.seasons)){
    for(const s of movie.seasons){
      if(!s)continue;
      const sNum=Number(s.season_number);
      if(sNum>0){
        seasonsMap.set(sNum,{
          season_number:sNum,
          name:s.name||`Season ${sNum}`,
          episode_count:Number(s.episode_count)||0,
          poster_path:s.poster_path?`https://image.tmdb.org/t/p/w300${s.poster_path}`:'',
          overview:s.overview||'',
          air_date:s.air_date||''
        });
      }
    }
  }
  const totalSeasons=Math.max(
    Number(movie.numberOfSeasons)||1,
    seasonsMap.size,
    ...(seasonsMap.size?Array.from(seasonsMap.keys()):[1])
  );
  for(let s=1;s<=totalSeasons;s++){
    if(!seasonsMap.has(s)){
      seasonsMap.set(s,{
        season_number:s,
        name:`Season ${s}`,
        episode_count:24,
        poster_path:'',
        overview:'',
        air_date:''
      });
    }
  }
  return Array.from(seasonsMap.values()).sort((a,b)=>a.season_number-b.season_number);
}

function getAvailableEpisodes(movie,seasonNum){
  const sNum=Number(seasonNum)||1;
  const cached=movie.seasonEpisodes?.[sNum];
  if(Array.isArray(cached)&&cached.length){
    const list=cached
      .filter(ep=>ep&&ep.episode_number>0)
      .map(ep=>({
        number:Number(ep.episode_number),
        name:ep.name||`Episode ${ep.episode_number}`,
        overview:ep.overview||'',
        still:ep.still_path?`https://image.tmdb.org/t/p/w500${ep.still_path}`:'',
        air_date:ep.air_date||'',
        vote_average:Number(ep.vote_average)||0,
        runtime:Number(ep.runtime)||0
      }))
      .sort((a,b)=>a.number-b.number);
    if(list.length)return list;
  }
  const sData=getAvailableSeasons(movie).find(s=>Number(s.season_number)===sNum);
  const epMax=Number(sData?.episode_count)>0?Number(sData.episode_count):24;
  const list=[];
  for(let e=1;e<=epMax;e++){
    list.push({
      number:e,
      name:`Episode ${e}`,
      overview:'',
      still:'',
      air_date:'',
      vote_average:0,
      runtime:0
    });
  }
  return list;
}

async function fetchSeasonEpisodes(movie,seasonNum){
  if(!movie||!movie.tmdbId)return [];
  const sNum=Number(seasonNum)||1;
  movie.seasonEpisodes=movie.seasonEpisodes||{};
  if(Array.isArray(movie.seasonEpisodes[sNum])&&movie.seasonEpisodes[sNum].length){
    return movie.seasonEpisodes[sNum];
  }
  const cacheKey=`${movie.id||movie.tmdbId}-s${sNum}`;
  if(pendingSeasonFetches.has(cacheKey)){
    return pendingSeasonFetches.get(cacheKey);
  }
  const p=(async()=>{
    try{
      let r=await fetch(`/api/title/tv/${movie.tmdbId}/season/${sNum}`);
      if(!r.ok)r=await fetch(`/api/title?type=tv&id=${movie.tmdbId}&season=${sNum}`);
      if(!r.ok)return [];
      const sd=await r.json();
      if(sd&&Array.isArray(sd.episodes)){
        movie.seasonEpisodes[sNum]=sd.episodes;
        const key=movie.id||`tmdb-tv-${movie.tmdbId}`;
        const cached=titleMetaCache.get(key)||{};
        cached.seasonEpisodes=cached.seasonEpisodes||{};
        cached.seasonEpisodes[sNum]=sd.episodes;
        titleMetaCache.set(key,cached);
        return sd.episodes;
      }
    }catch(err){
      console.warn('Failed to load season episodes',err);
    }finally{
      pendingSeasonFetches.delete(cacheKey);
    }
    return [];
  })();
  pendingSeasonFetches.set(cacheKey,p);
  return p;
}

async function renderDetailSeasons(movie){
  const section=$('#detail-seasons-section');
  if(!section)return;
  const isTV=isTvSeries(movie);
  if(!isTV){
    section.hidden=true;
    return;
  }
  section.hidden=false;

  if((!movie.seasons||!movie.seasons.length)&&movie.source==='TMDB'&&movie.tmdbId){
    await ensureTvMetadata(movie);
    if(activeMovie?.id!==movie.id)return;
  }

  const seasons=getAvailableSeasons(movie);
  if(!seasons.length){
    section.hidden=true;
    return;
  }
  if(!seasons.some(s=>s.season_number===detailSelectedSeason)){
    detailSelectedSeason=seasons[0].season_number;
  }

  const badge=$('#seasons-badge');
  if(badge){
    const totalS=seasons.length;
    badge.textContent=`${totalS} ${totalS===1?'Season':'Seasons'}`;
  }

  const select=$('#detail-season-select');
  if(select){
    const optionsHtml=seasons.map(s=>{
      const epCount=Number(s.episode_count)>0?` (${s.episode_count} eps)`:'';
      return `<option value="${s.season_number}">${s.name||`Season ${s.season_number}`}${epCount}</option>`;
    }).join('');
    if(select.dataset.renderedHtml!==optionsHtml){
      select.innerHTML=optionsHtml;
      select.dataset.renderedHtml=optionsHtml;
    }
    if(select.value!==String(detailSelectedSeason)){
      select.value=String(detailSelectedSeason);
    }
    select.onchange=()=>{
      selectDetailSeason(Number(select.value)||1);
    };
  }

  const pillsContainer=$('#seasons-pills');
  if(pillsContainer){
    const seasonsKey=seasons.map(s=>s.season_number).join(',');
    if(pillsContainer.dataset.renderedKey!==seasonsKey){
      pillsContainer.innerHTML=seasons.map(s=>{
        const active=s.season_number===detailSelectedSeason?'active':'';
        return `<button type="button" class="season-pill ${active}" data-season="${s.season_number}" role="tab" aria-selected="${s.season_number===detailSelectedSeason}">${s.name||`Season ${s.season_number}`}</button>`;
      }).join('');
      pillsContainer.dataset.renderedKey=seasonsKey;
      pillsContainer.querySelectorAll('.season-pill').forEach(btn=>{
        btn.onclick=()=>{
          const sNum=Number(btn.dataset.season)||1;
          selectDetailSeason(sNum);
        };
      });
    }else{
      pillsContainer.querySelectorAll('.season-pill').forEach(btn=>{
        const isAct=Number(btn.dataset.season)===detailSelectedSeason;
        btn.classList.toggle('active',isAct);
        btn.setAttribute('aria-selected',isAct?'true':'false');
      });
    }
  }

  await renderSeasonEpisodes(movie,detailSelectedSeason);
}

function selectDetailSeason(sNum){
  detailSelectedSeason=sNum;
  if($('#detail-season-select'))$('#detail-season-select').value=String(sNum);
  $$('#seasons-pills .season-pill').forEach(p=>{
    const isAct=Number(p.dataset.season)===sNum;
    p.classList.toggle('active',isAct);
    p.setAttribute('aria-selected',isAct?'true':'false');
  });
  if(activeMovie){
    renderSeasonEpisodes(activeMovie,sNum);
    const play=$('#detail-play'),restartBtn=$('#detail-restart');
    if(play){
      const ep=activeMovie.mediaType==='tv'?(progress[activeMovie.id]?.episode||1):1;
      const prog=getResumeProgress(activeMovie.id,sNum,ep);
      const resumeTime=prog.time||0;
      if(resumeTime>10){
        const timeLabel=formatTimestamp(resumeTime);
        play.innerHTML=`<span class="play-triangle">${SVG_PLAY}</span> Resume S${sNum}:E${ep} · ${timeLabel}`;
        play.title=`Resume from ${timeLabel}`;
        if(restartBtn){
          restartBtn.hidden=false;
          restartBtn.onclick=()=>playMovie(activeMovie,{season:sNum,episode:ep,resetTime:true});
        }
      }else{
        play.innerHTML=`<span class="play-triangle">${SVG_PLAY}</span> Play S${sNum}:E${ep}`;
        play.title='Play';
        if(restartBtn)restartBtn.hidden=true;
      }
      play.onclick=()=>playMovie(activeMovie,{season:sNum,episode:ep});
    }
  }
}

async function renderSeasonEpisodes(movie,seasonNum){
  const grid=$('#episodes-grid');
  if(!grid||activeMovie?.id!==movie.id)return;

  const currentEps=getAvailableEpisodes(movie,seasonNum);
  const drawList=(eps)=>{
    if(activeMovie?.id!==movie.id)return;
    const isPlayingThisTitle=isPlayerActive()&&activeMovie?.id===movie.id;
    const currentPlayingS=currentSeason;
    const currentPlayingE=currentEpisode;

    const subEl=$('#detail-ep-submeta');
    if(subEl){
      const age=getMovieAgeRating(movie);
      subEl.innerHTML=`<span>Season ${seasonNum}</span>${age?`<span class="age-rating-pill">${escapeHtml(age)}</span>`:''}<span>${eps.length} ${eps.length===1?'Episode':'Episodes'}</span>`;
    }

    grid.innerHTML=eps.map(ep=>{
      const isCur=isPlayingThisTitle&&currentPlayingS===seasonNum&&currentPlayingE===ep.number;
      const thumb=ep.still||movie.backdrop||movie.poster||'';
      const epProg=getResumeProgress(movie.id,seasonNum,ep.number);
      const epPct=epProg.pct||0;
      return `
        <article class="nf-modal-ep-row ${isCur?'playing':''}" data-season="${seasonNum}" data-episode="${ep.number}" role="button" tabindex="0" aria-label="Play Season ${seasonNum} Episode ${ep.number}: ${escapeHtml(ep.name)}">
          <span class="nf-modal-ep-num">${ep.number}</span>
          <div class="nf-modal-ep-thumb">
            ${thumb?`<img src="${escapeHtml(thumb)}" alt="${escapeHtml(ep.name)}" loading="lazy" />`:''}
            <div class="nf-modal-ep-play"><span>${SVG_PLAY}</span></div>
            ${epPct>0?`<div class="episode-progress-track"><div class="episode-progress-fill" style="width:${epPct}%"></div></div>`:''}
          </div>
          <div class="nf-modal-ep-info">
            <div class="nf-modal-ep-top">
              <h3 class="nf-modal-ep-title">${escapeHtml(ep.name||`Episode ${ep.number}`)}${isCur?`<span class="nf-modal-ep-playing-tag">● NOW PLAYING</span>`:''}</h3>
              ${ep.runtime?`<span class="nf-modal-ep-dur">${ep.runtime}m</span>`:''}
            </div>
            <p class="nf-modal-ep-desc">${escapeHtml(ep.overview||'Watch this episode on MovieBox.')}</p>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('.nf-modal-ep-row').forEach(card=>{
      const onPick=()=>{
        const s=Number(card.dataset.season)||1;
        const e=Number(card.dataset.episode)||1;
        const epProg=getResumeProgress(movie.id,s,e);
        playMovie(movie,{season:s,episode:e,resumeTime:epProg.time||0});
        const stage=$('#player-stage');
        if(stage){
          stage.hidden=false;
          stage.scrollIntoView({behavior:'smooth',block:'nearest'});
        }
      };
      card.onclick=onPick;
      card.onkeydown=evt=>{
        if(evt.key==='Enter'||evt.key===' '){
          evt.preventDefault();
          onPick();
        }
      };
    });
  };

  drawList(currentEps);

  if(!movie.seasonEpisodes?.[seasonNum]&&movie.source==='TMDB'&&movie.tmdbId){
    const fetched=await fetchSeasonEpisodes(movie,seasonNum);
    if(activeMovie?.id===movie.id&&detailSelectedSeason===seasonNum&&fetched.length){
      drawList(getAvailableEpisodes(movie,seasonNum));
      const sSel=$('#season-select'),eSel=$('#episode-select');
      if(sSel&&Number(sSel.value)===seasonNum&&eSel){
        const updatedEps=getAvailableEpisodes(movie,seasonNum);
        const eOptionsHtml=updatedEps.map(ep=>`<option value="${ep.number}">${ep.name?`E${ep.number} · ${ep.name}`:`Episode ${ep.number}`}</option>`).join('');
        if(eSel.dataset.renderedHtml!==eOptionsHtml){
          eSel.innerHTML=eOptionsHtml;
          eSel.dataset.renderedHtml=eOptionsHtml;
        }
        if(eSel.value!==String(currentEpisode)){
          eSel.value=String(currentEpisode);
        }
      }
    }
  }
}

function playMovie(movie,{preserveEpisode=false,resetTime=false,season,episode,resumeTime:requestedTime}={}){
  const prevId=activeMovie?.id;
  activeMovie=movie;
  const isTV=isTvSeries(movie);
  if(isTV)movie.mediaType='tv';

  if(season!==undefined&&episode!==undefined){
    currentSeason=Number(season)||1;
    currentEpisode=Number(episode)||1;
  }else if(prevId!==movie.id){
    currentSeason=(isTV&&!preserveEpisode&&progress[movie.id]?.season)?Number(progress[movie.id].season)||1:detailSelectedSeason||1;
    currentEpisode=(isTV&&!preserveEpisode&&progress[movie.id]?.episode)?Number(progress[movie.id].episode)||1:1;
  }else if(isTV&&!preserveEpisode&&progress[movie.id]?.season&&progress[movie.id]?.episode){
    currentSeason=Number(progress[movie.id].season)||currentSeason;
    currentEpisode=Number(progress[movie.id].episode)||currentEpisode;
  }
  detailSelectedSeason=currentSeason;

  const prog=getResumeProgress(movie.id,isTV?currentSeason:undefined,isTV?currentEpisode:undefined);
  const resumeTime=resetTime?0:(requestedTime!==undefined?Math.max(0,Math.floor(Number(requestedTime)||0)):(Number(prog.time)||0));
  progressItems[movie.id]=movie;

  savePlaybackProgress(movie.id,{
    season:isTV?currentSeason:undefined,
    episode:isTV?currentEpisode:undefined,
    time:resumeTime,
    duration:prog.duration||0,
    completed:false
  });

  const video=$('#video-player'),frame=$('#stream-player');
  const directSource=movie.hlsUrl||movie.videoUrl||'';
  const embedded=!directSource&&movie.source==='TMDB'&&movie.tmdbId;
  destroyHls();
  try{video.pause();video.removeAttribute('src');video.querySelectorAll('track').forEach(t=>t.remove())}catch{}
  try{frame.removeAttribute('src')}catch{}
  video.hidden=Boolean(embedded);
  video.controls=false;
  frame.hidden=!embedded;
  const nhud=$('#native-player-hud');
  if(nhud){nhud.hidden=Boolean(embedded);nhud.classList.remove('visible')}
  $('#quality-option').hidden=Boolean(embedded);
  $('#subtitle-option').hidden=Boolean(embedded);
  $('#server-option').hidden=!embedded;
  if($('#season-option'))$('#season-option').hidden=!isTV;
  if($('#episode-option'))$('#episode-option').hidden=!isTV;
  if($('#player-prev-ep'))$('#player-prev-ep').hidden=!isTV;
  if($('#player-next-ep'))$('#player-next-ep').hidden=!isTV;
  if($('#player-skip-intro'))$('#player-skip-intro').hidden=!isTV;
  $('#player-reload').hidden=!embedded;
  $('#player-title').textContent=movie.title;
  $('#player-subtitle').textContent=isTV?`Season ${currentSeason} · Episode ${currentEpisode}${movie.year?` · ${movie.year}`:''}`:`${movie.tag?'A MovieBox Original · ':''}${movie.year||''}${movie.duration?` · ${movie.duration}`:''}`;
  playerHasStarted=false;
  pendingResumeTarget=resumeTime>5?{movieId:movie.id,time:resumeTime,startedAt:Date.now(),seekAttempts:0}:null;
  populatePauseOverlay(movie);
  hidePauseOverlay();
  if(embedded){
    applyAdBlockerSandbox();
    frame.setAttribute('tabindex','0');
    frame.referrerPolicy=currentStreamServer==='vidlink'?'origin':'no-referrer';
    frame.onload=()=>{
      if(isPlayerActive()&&!frame.hidden){
        unmuteIframePlayer(frame);
        const fsBack=$('#fs-back-btn');
        if(fsBack&&isFullscreenPlayerActive()){
          try{fsBack.focus({preventScroll:true})}catch{}
          fsBack.classList.add('tv-focus');
        }
      }
    };
    const type=isTV?'tv':'movie';
    if($('#server-select'))$('#server-select').value=currentStreamServer;
    const sSel=$('#season-select'),eSel=$('#episode-select'),prevBtn=$('#player-prev-ep'),nextBtn=$('#player-next-ep'),skipBtn=$('#player-skip-intro');
    const updateEpNavButtons=(seasons,eps)=>{
      if(!isTV)return;
      const sIdx=seasons.findIndex(s=>Number(s.season_number)===Number(currentSeason));
      const eIdx=eps.findIndex(ep=>Number(ep.number)===Number(currentEpisode));
      if(prevBtn)prevBtn.disabled=(sIdx<=0&&eIdx<=0);
      if(nextBtn)nextBtn.disabled=(sIdx>=seasons.length-1&&eIdx>=eps.length-1);
    };
    const updateTvPickers=()=>{
      if(!isTV||!sSel||!eSel)return;
      const seasonList=getAvailableSeasons(movie);
      if(!seasonList.some(s=>Number(s.season_number)===Number(currentSeason))&&seasonList.length){
        currentSeason=Number(seasonList[0].season_number);
      }
      const sOptionsHtml=seasonList.map(s=>{const sNum=Number(s.season_number);return `<option value="${sNum}">${s.name||`Season ${sNum}`}</option>`}).join('');
      if(sSel.dataset.renderedHtml!==sOptionsHtml){
        sSel.innerHTML=sOptionsHtml;
        sSel.dataset.renderedHtml=sOptionsHtml;
      }
      if(sSel.value!==String(currentSeason)){
        sSel.value=String(currentSeason);
      }
      const eps=getAvailableEpisodes(movie,currentSeason);
      if(!eps.some(ep=>ep.number===Number(currentEpisode))&&eps.length){
        currentEpisode=eps[0].number;
      }
      const eOptionsHtml=eps.map(ep=>`<option value="${ep.number}">${ep.name?`E${ep.number} · ${ep.name}`:`Episode ${ep.number}`}</option>`).join('');
      if(eSel.dataset.renderedHtml!==eOptionsHtml){
        eSel.innerHTML=eOptionsHtml;
        eSel.dataset.renderedHtml=eOptionsHtml;
      }
      if(eSel.value!==String(currentEpisode)){
        eSel.value=String(currentEpisode);
      }
      $('#player-subtitle').textContent=`Season ${currentSeason} · Episode ${currentEpisode}${movie.year?` · ${movie.year}`:''}`;
      updateEpNavButtons(seasonList,eps);
    };
    const switchEpisode=(nextS,nextE)=>{
      currentSeason=Number(nextS)||1;
      currentEpisode=Number(nextE)||1;
      detailSelectedSeason=currentSeason;
      const epProg=getResumeProgress(movie.id,currentSeason,currentEpisode);
      const epResume=epProg.time||0;
      savePlaybackProgress(movie.id,{season:currentSeason,episode:currentEpisode,time:epResume,duration:epProg.duration||0,completed:false});
      updateTvPickers();
      loadSeasonEpisodes(currentSeason);
      renderDetailSeasons(movie);
      frame.src=getStreamUrl(currentStreamServer,'tv',movie.tmdbId,epResume,currentSeason,currentEpisode);
      notify(epResume>10?`Loaded S${currentSeason} E${currentEpisode} · Resumed from ${formatTimestamp(epResume)}`:`Loaded Season ${currentSeason}, Episode ${currentEpisode}`);
    };
    const loadSeasonEpisodes=async(seasonNum)=>{
      if(!isTV)return;
      await fetchSeasonEpisodes(movie,seasonNum);
      if(activeMovie?.id===movie.id){
        updateTvPickers();
      }
    };
    if(isTV){
      updateTvPickers();
      loadSeasonEpisodes(currentSeason);
      sSel.onchange=()=>switchEpisode(Number(sSel.value)||1,1);
      eSel.onchange=()=>switchEpisode(currentSeason,Number(eSel.value)||1);
      if(prevBtn)prevBtn.onclick=()=>{
        const seasons=getAvailableSeasons(movie);
        const eps=getAvailableEpisodes(movie,currentSeason);
        const eIdx=eps.findIndex(ep=>ep.number===Number(currentEpisode));
        if(eIdx>0){switchEpisode(currentSeason,eps[eIdx-1].number);return}
        const sIdx=seasons.findIndex(s=>Number(s.season_number)===Number(currentSeason));
        if(sIdx>0){
          const prevS=Number(seasons[sIdx-1].season_number);
          const prevEps=getAvailableEpisodes(movie,prevS);
          switchEpisode(prevS,prevEps[prevEps.length-1]?.number||1);
        }
      };
      if(nextBtn)nextBtn.onclick=()=>{
        const seasons=getAvailableSeasons(movie);
        const eps=getAvailableEpisodes(movie,currentSeason);
        const eIdx=eps.findIndex(ep=>ep.number===Number(currentEpisode));
        if(eIdx>=0&&eIdx<eps.length-1){switchEpisode(currentSeason,eps[eIdx+1].number);return}
        const sIdx=seasons.findIndex(s=>Number(s.season_number)===Number(currentSeason));
        if(sIdx>=0&&sIdx<seasons.length-1){
          const nextS=Number(seasons[sIdx+1].season_number);
          const nextEps=getAvailableEpisodes(movie,nextS);
          switchEpisode(nextS,nextEps[0]?.number||1);
        }
      };
      if(skipBtn)skipBtn.onclick=()=>{
        const curProg=getResumeProgress(movie.id,currentSeason,currentEpisode);
        const curTime=curProg.time||0;
        const targetTime=curTime<85?90:curTime+85;
        savePlaybackProgress(movie.id,{season:currentSeason,episode:currentEpisode,time:targetTime,duration:curProg.duration||0,completed:false});
        frame.src=getStreamUrl(currentStreamServer,'tv',movie.tmdbId,targetTime,currentSeason,currentEpisode);
        notify(`Skipped intro · Jumped to ${formatTimestamp(targetTime)}`);
      };
      const loadTvDetails=async()=>{
        await ensureTvMetadata(movie);
        if(activeMovie?.id!==movie.id)return;
        updateTvPickers();
        loadSeasonEpisodes(currentSeason);
        renderDetailSeasons(movie);
      };
      loadTvDetails();
    }
    frame.src=getStreamUrl(currentStreamServer,type,movie.tmdbId,resumeTime,currentSeason,currentEpisode);
    if(resumeTime>10){
      notify(isTV?`Resuming S${currentSeason} E${currentEpisode} from ${formatTimestamp(resumeTime)}`:`Resuming from ${formatTimestamp(resumeTime)}`);
    }
    $('#quality-select').innerHTML='<option value="auto">Player controls</option>';
    $('#subtitle-select').innerHTML='<option value="off">Player controls</option>';
    updateAdBlockUI();
  }else{
    const qMap=movie.qualityUrls||(directSource?{'1080':directSource}:DEMO_QUALITIES);
    const initialQuality=qMap['1080']?'1080':(Object.keys(qMap)[0]||'auto');
    const sourceUrl=movie.hlsUrl||qMap[initialQuality]||directSource||DEMO_1080P;
    const isHls=/\.m3u8(\?|$)/i.test(sourceUrl)||Boolean(movie.hlsUrl);

    const loadNativeUrl=(url,seekAfter=0,autoPlay=true)=>{
      destroyHls();
      const useHls=/\.m3u8(\?|$)/i.test(url);
      if(useHls&&window.Hls&&window.Hls.isSupported()){
        const hls=new window.Hls({startLevel:-1,capLevelToPlayerSize:false,enableWorker:true});
        activeHls=hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED,(_,data)=>{
          const levels=data?.levels||[];
          // Auto-select 1080p (or highest available <= 1080p)
          let best1080=-1,bestH=0;
          levels.forEach((lv,idx)=>{
            const h=lv.height||0;
            if(h<=1080&&h>bestH){bestH=h;best1080=idx}
          });
          if(best1080>=0){
            hls.currentLevel=best1080;
            hls.nextLevel=best1080;
          }
          if(levels.length){
            let opts='<option value="auto">Auto (1080p)</option>';
            levels.forEach((lv,idx)=>{
              if(lv.height)opts+=`<option value="hls-${idx}" ${idx===best1080?'selected':''}>${lv.height}p${lv.height>=1080?' Full HD':''}</option>`;
            });
            $('#quality-select').innerHTML=opts;
            updateNativeHudQualityLabel(bestH?`${bestH}p HD`:'Auto 1080p');
          }
          if(seekAfter>0)video.currentTime=seekAfter;
          video.muted=false;
          video.volume=1;
          if(autoPlay)video.play().catch(()=>{});
        });
        hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED,(_,data)=>{
          const tracks=data?.subtitleTracks||[];
          const enIdx=tracks.findIndex(t=>/^en/i.test(t.lang||'')||/english/i.test(t.name||''));
          if(enIdx>=0){
            hls.subtitleTrack=enIdx;
            hls.subtitleDisplay=true;
            updateNativeHudSubLabel('CC: English');
          }
        });
      }else{
        video.src=url;
        video.onloadedmetadata=()=>{
          if(seekAfter>0&&video.duration&&seekAfter<video.duration-5)video.currentTime=seekAfter;
          video.muted=false;
          video.volume=1;
          if(autoPlay)video.play().catch(()=>{});
        };
      }
    };

    if(movie.subtitlesUrl){
      const track=document.createElement('track');
      track.kind='subtitles';
      track.label=movie.subtitleLabel||'English';
      track.srclang=movie.subtitleLanguage||'en';
      track.src=movie.subtitlesUrl;
      track.default=true;
      video.append(track);
      setTimeout(()=>{if(track.track)track.track.mode='showing'},120);
    }

    let qOptions='<option value="auto">Auto (1080p)</option>';
    if(qMap['1080'])qOptions+=`<option value="1080" ${initialQuality==='1080'?'selected':''}>1080p Full HD</option>`;
    if(qMap['720'])qOptions+=`<option value="720" ${initialQuality==='720'?'selected':''}>720p HD</option>`;
    if(qMap['480'])qOptions+=`<option value="480" ${initialQuality==='480'?'selected':''}>480p SD</option>`;
    for(const k of Object.keys(qMap)){if(!['1080','720','480'].includes(k))qOptions+=`<option value="${k}">${k}p</option>`}
    $('#quality-select').innerHTML=qOptions;
    $('#quality-select').value=initialQuality;
    $('#quality-select').onchange=()=>{
      const next=$('#quality-select').value;
      if(next.startsWith('hls-')&&activeHls){
        const idx=Number(next.slice(4));
        activeHls.currentLevel=idx;
        const h=activeHls.levels?.[idx]?.height;
        updateNativeHudQualityLabel(h?`${h}p`:'Auto');
        notify(`Quality set to ${h?`${h}p`:'Auto'}`);
        return;
      }
      if(next==='auto'&&activeHls){
        activeHls.currentLevel=-1;
        updateNativeHudQualityLabel('Auto 1080p');
        notify('Quality set to Auto (1080p)');
        return;
      }
      const targetUrl=next==='auto'?(qMap['1080']||directSource||DEMO_1080P):(qMap[next]||directSource||DEMO_1080P);
      loadNativeUrl(targetUrl,video.currentTime,!video.paused);
      updateNativeHudQualityLabel(next==='auto'?'Auto 1080p':`${next}p`);
      notify(`Quality set to ${next==='auto'?'Auto (1080p Full HD)':next+'p'}`);
    };

    const hasSub=Boolean(movie.subtitlesUrl);
    $('#subtitle-select').innerHTML=`<option value="off">Off</option>${hasSub?`<option value="en" selected>${movie.subtitleLabel||'English'}</option>`:''}`;
    $('#subtitle-select').value=hasSub?'en':'off';
    $('#subtitle-select').onchange=e=>{
      const on=e.target.value!=='off';
      if(activeHls&&activeHls.subtitleTracks?.length){
        activeHls.subtitleDisplay=on;
        activeHls.subtitleTrack=on?0:-1;
      }
      video.querySelectorAll('track').forEach(t=>{if(t.track)t.track.mode=on?'showing':'disabled'});
      updateNativeHudSubLabel(on?'CC: English':'CC: Off');
    };

    video.onpause=()=>{syncNativeHudState();if(isNativeVideoActive())showNativeHud($('#nhud-play'),0)};
    video.onplay=()=>{playerHasStarted=true;syncNativeHudState();showNativeHud(null,3500)};
    video.onvolumechange=()=>syncNativeHudState();
    video.onended=()=>{playerHasStarted=false;syncNativeHudState();showNativeHud($('#nhud-play'),0)};
    video.ontimeupdate=()=>{
      if(video.duration){
        updateNativeHudProgress(video.currentTime,video.duration);
        progressItems[movie.id]=movie;
        const now=Date.now();
        if(now-lastProgressSave>2000){
          lastProgressSave=now;
          savePlaybackProgress(movie.id,{
            time:video.currentTime,
            duration:video.duration,
            completed:video.currentTime>=video.duration-15
          });
        }
      }
    };

    loadNativeUrl(sourceUrl,resumeTime,true);
    updateNativeHudMeta(movie,isHls?'Native HLS · Auto 1080p · EN Sub':'Native 1080p HD · EN Sub');
    updateNativeHudQualityLabel('1080p HD');
    updateNativeHudSubLabel(hasSub?'CC: English':'CC: Auto EN');
  }
  const stage=$('#player-stage');
  if(stage){
    stage.hidden=false;
  }
  if(!embedded){
    video.muted=false;
    video.volume=1;
    video.play().catch(()=>{});
  }
  enterFullscreenPlayer(movie);
}

let playerHasStarted=false;
let embedIsPlaying=true;
let embedCurTime=0;
let embedDuration=0;
let embedVolume=1;
let pendingResumeTarget=null;
let nativeHudTimer=null;

const SVG_NHUD_PAUSE=`<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
const SVG_NHUD_PLAY=`<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;

function isFullscreenPlayerActive(){
  return document.body.classList.contains('player-fullscreen-mode')&&isPlayerActive();
}

function isNativeVideoActive(){
  const video=$('#video-player');
  return Boolean(isPlayerActive()&&video&&!video.hidden);
}

function isNativeHudVisible(){
  return Boolean($('#native-player-hud')?.classList.contains('visible'));
}

function updateNativeHudMeta(movie,subText){
  const tEl=$('#nhud-title'),sEl=$('#nhud-sub');
  if(tEl&&movie)tEl.textContent=movie.title;
  if(sEl)sEl.textContent=subText||'Native 1080p HD';
}

function updateNativeHudQualityLabel(label){
  const b=$('#nhud-quality-badge'),btn=$('#nhud-qual-btn');
  if(b)b.textContent=label;
  if(btn)btn.textContent=`Quality: ${label}`;
}

function updateNativeHudSubLabel(label){
  const btn=$('#nhud-sub-btn');
  if(btn)btn.textContent=label;
}

function updateNativeHudProgress(cur,dur){
  const cEl=$('#nhud-cur'),dEl=$('#nhud-dur'),fill=$('#nhud-bar-fill');
  if(cEl)cEl.textContent=formatTimestamp(cur);
  if(dEl)dEl.textContent=formatTimestamp(dur);
  if(fill&&dur>0){
    fill.style.width=`${Math.min(100,Math.max(0,(cur/dur)*100)).toFixed(1)}%`;
  }
}

function syncNativeHudState(){
  const video=$('#video-player');
  if(!video)return;
  const icon=$('#nhud-play-icon'),muteBtn=$('#nhud-mute');
  if(icon)icon.innerHTML=video.paused?SVG_NHUD_PLAY:SVG_NHUD_PAUSE;
  if(muteBtn)muteBtn.textContent=video.muted?'🔇 Sound: MUTED':'🔊 Sound: ON';
}

function hideNativeHud(){
  clearTimeout(nativeHudTimer);
  const nhud=$('#native-player-hud');
  if(nhud)nhud.classList.remove('visible');
}

function showNativeHud(focusTarget,autoHideMs=4000){
  if(!isNativeVideoActive())return;
  const nhud=$('#native-player-hud');
  if(!nhud)return;
  nhud.hidden=false;
  syncNativeHudState();
  nhud.classList.add('visible');
  if(focusTarget&&!focusTarget.hidden){
    try{focusTarget.focus({preventScroll:true})}catch{}
    document.querySelectorAll('.tv-focus').forEach(x=>x.classList.remove('tv-focus'));
    focusTarget.classList.add('tv-focus');
  }
  clearTimeout(nativeHudTimer);
  const video=$('#video-player');
  if(video&&!video.paused&&autoHideMs>0){
    nativeHudTimer=setTimeout(hideNativeHud,autoHideMs);
  }
}

function nativeTogglePlayPause(){
  const video=$('#video-player');
  if(!video||video.hidden)return;
  if(video.paused){
    video.muted=false;
    video.volume=1;
    video.play().catch(()=>{});
  }else{
    video.pause();
  }
  syncNativeHudState();
  showNativeHud($('#nhud-play'),video.paused?0:3500);
}

function nativeSeekBy(deltaSec){
  const video=$('#video-player');
  if(!video||video.hidden)return;
  const target=Math.max(0,Math.min(video.duration||Infinity,(video.currentTime||0)+deltaSec));
  video.currentTime=target;
  updateNativeHudProgress(target,video.duration||0);
  showNativeHud(deltaSec<0?$('#nhud-rw'):$('#nhud-ff'),3500);
  notify(deltaSec>0?`⏩ +${deltaSec}s · ${formatTimestamp(target)}`:`⏪ ${deltaSec}s · ${formatTimestamp(target)}`);
}

const fsBackBtn=$('#fs-back-btn');
if(fsBackBtn){
  const onFsBack=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    exitFullscreenPlayer();
  };
  fsBackBtn.addEventListener('click',onFsBack);
  fsBackBtn.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '||e.keyCode===13){
      onFsBack(e);
    }
  });
}
$('#nhud-back')?.addEventListener('click',()=>exitFullscreenPlayer());
$('#nhud-play')?.addEventListener('click',()=>nativeTogglePlayPause());
$('#nhud-rw')?.addEventListener('click',()=>nativeSeekBy(-10));
$('#nhud-ff')?.addEventListener('click',()=>nativeSeekBy(10));
$('#nhud-mute')?.addEventListener('click',()=>{
  const video=$('#video-player');
  if(!video)return;
  video.muted=!video.muted;
  if(!video.muted&&video.volume===0)video.volume=1;
  syncNativeHudState();
  showNativeHud($('#nhud-mute'),3500);
});
$('#nhud-sub-btn')?.addEventListener('click',()=>{
  const video=$('#video-player');
  if(!video)return;
  let anyOn=false;
  if(activeHls&&activeHls.subtitleTracks?.length){
    anyOn=activeHls.subtitleDisplay&&activeHls.subtitleTrack>=0;
    activeHls.subtitleDisplay=!anyOn;
    activeHls.subtitleTrack=anyOn?-1:0;
    updateNativeHudSubLabel(anyOn?'CC: Off':'CC: English');
  }else{
    const tracks=[...video.textTracks];
    anyOn=tracks.some(t=>t.mode==='showing');
    tracks.forEach(t=>{t.mode=anyOn?'disabled':'showing'});
    updateNativeHudSubLabel(tracks.length?(anyOn?'CC: Off':'CC: English'):'CC: None');
  }
  showNativeHud($('#nhud-sub-btn'),3500);
});
$('#nhud-qual-btn')?.addEventListener('click',()=>{
  const qSel=$('#quality-select');
  if(!qSel||!qSel.options.length)return;
  qSel.selectedIndex=(qSel.selectedIndex+1)%qSel.options.length;
  qSel.dispatchEvent(new Event('change'));
  showNativeHud($('#nhud-qual-btn'),3500);
});
$('#nhud-bar')?.addEventListener('click',e=>{
  const video=$('#video-player'),bar=$('#nhud-bar');
  if(!video||!video.duration||!bar)return;
  const r=bar.getBoundingClientRect();
  const ratio=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  video.currentTime=ratio*video.duration;
  updateNativeHudProgress(video.currentTime,video.duration);
  showNativeHud($('#nhud-play'),3500);
});
$('.player-media-wrap')?.addEventListener('mousemove',()=>{
  if(isNativeVideoActive())showNativeHud(null,3500);
},{passive:true});

function unmuteIframePlayer(frame){
  if(!frame?.contentWindow)return;
  const payloads=[
    {event:'command',func:'unMute'},
    {method:'unmute'},
    {event:'unmute'},
    {action:'unmute'},
    {type:'UNMUTE'},
    {method:'setMuted',muted:false},
    {method:'setVolume',volume:1},
    {event:'setVolume',volume:1}
  ];
  for(const p of payloads){
    try{frame.contentWindow.postMessage(p,'*')}catch{}
    try{frame.contentWindow.postMessage(JSON.stringify(p),'*')}catch{}
  }
}

function enterFullscreenPlayer(movie){
  const stage=$('#player-stage');
  if(!stage)return;
  embedIsPlaying=true;
  embedCurTime=0;
  embedDuration=0;
  stage.hidden=false;
  stage.classList.add('is-fullscreen');
  stage.setAttribute('tabindex','-1');
  document.body.classList.add('player-fullscreen-mode');
  if(movie&&!window.location.hash.startsWith('#watch/')){
    history.pushState({view:'player',id:movie.id},'',`#watch/${encodeURIComponent(movie.id)}`);
  }
  // On VIDAA TV, CSS .is-fullscreen is already 100% fullscreen; skipping native requestFullscreen
  // prevents native fullscreen from swallowing the remote Back button.
  if(!document.body.classList.contains('vidaa-tv')){
    try{
      if(!document.fullscreenElement&&!document.webkitFullscreenElement){
        if(stage.requestFullscreen)stage.requestFullscreen().catch(()=>{});
        else if(stage.webkitRequestFullscreen)stage.webkitRequestFullscreen();
      }
    }catch{}
  }
  setTimeout(()=>{
    if(isNativeVideoActive()){
      showNativeHud($('#nhud-play'),4000);
      return;
    }
    const frame=$('#stream-player');
    if(frame&&!frame.hidden){
      unmuteIframePlayer(frame);
    }
    const fsBack=$('#fs-back-btn');
    if(fsBack){
      try{fsBack.focus({preventScroll:true})}catch{}
      document.querySelectorAll('.tv-focus').forEach(x=>x.classList.remove('tv-focus'));
      fsBack.classList.add('tv-focus');
    }
  },180);
}

['fullscreenchange','webkitfullscreenchange'].forEach(evt=>{
  document.addEventListener(evt,()=>{
    if(!document.fullscreenElement&&!document.webkitFullscreenElement&&isFullscreenPlayerActive()&&!document.body.classList.contains('vidaa-tv')){
      exitFullscreenPlayer();
    }
  });
});

function embedTogglePlayPause(forcePlaying){
  const frame=$('#stream-player');
  if(!frame?.contentWindow||frame.hidden)return;
  const nextPlaying=typeof forcePlaying==='boolean'?forcePlaying:!embedIsPlaying;
  embedIsPlaying=nextPlaying;
  const action=nextPlaying?'play':'pause';
  try{frame.contentWindow.postMessage({command:action},'*')}catch{}
  sendIframePlaybackCmd(frame,action);
  notify(nextPlaying?'▶ Playing':'⏸ Paused');
}

function embedSeekBy(deltaSec){
  const frame=$('#stream-player');
  if(!frame?.contentWindow||frame.hidden)return;
  const isTV=activeMovie?isTvSeries(activeMovie):false;
  const prog=activeMovie?getResumeProgress(activeMovie.id,isTV?currentSeason:undefined,isTV?currentEpisode:undefined):{time:0};
  const base=Math.max(embedCurTime,Number(prog.time)||0);
  const target=Math.max(0,embedDuration>0?Math.min(embedDuration-1,base+deltaSec):base+deltaSec);
  embedCurTime=target;
  try{frame.contentWindow.postMessage({command:'seek',time:target},'*')}catch{}
  enforceIframeSeek(frame,target);
  notify(deltaSec>0?`⏩ +${deltaSec}s · ${formatTimestamp(target)}`:`⏪ ${deltaSec}s · ${formatTimestamp(target)}`);
}

function embedAdjustVolume(delta){
  const frame=$('#stream-player');
  if(!frame?.contentWindow||frame.hidden)return;
  embedVolume=Math.max(0,Math.min(1,Math.round((embedVolume+delta)*10)/10));
  try{frame.contentWindow.postMessage({command:'volume',level:embedVolume},'*')}catch{}
  try{frame.contentWindow.postMessage({method:'setVolume',volume:embedVolume},'*')}catch{}
  notify(embedVolume===0?'🔇 Muted':`🔊 Volume ${Math.round(embedVolume*100)}%`);
}

function exitFullscreenPlayer({fromHistory=false}={}){
  const frame=$('#stream-player');
  if(document.activeElement===frame){try{frame.blur()}catch{}}
  stopPlayer();
  if(!fromHistory&&window.location.hash.startsWith('#watch/')&&activeMovie){
    history.replaceState({view:'detail',id:activeMovie.id},'',`#title/${encodeURIComponent(activeMovie.id)}`);
  }
  window.scrollTo(0,0);
  setTimeout(()=>{
    const target=$('#detail-play')||$('#detail-back');
    if(target){
      try{target.focus({preventScroll:true})}catch{}
      document.querySelectorAll('.tv-focus').forEach(x=>x.classList.remove('tv-focus'));
      target.classList.add('tv-focus');
    }
  },60);
}

function sendIframePlaybackCmd(frame,action){
  if(!frame?.contentWindow)return;
  const payloads=[
    {event:'command',func:action},
    {method:action},
    {type:action.toUpperCase()},
    {event:action},
    {action},
    {command:action}
  ];
  for(const p of payloads){
    try{frame.contentWindow.postMessage(p,'*')}catch{}
    try{frame.contentWindow.postMessage(JSON.stringify(p),'*')}catch{}
  }
}

function enforceIframeSeek(frame,targetSec){
  if(!frame?.contentWindow||!targetSec||targetSec<=0)return;
  const payloads=[
    {method:'seek',time:targetSec},
    {event:'seek',time:targetSec,currentTime:targetSec},
    {type:'SEEK',time:targetSec},
    {action:'seek',time:targetSec},
    {command:'seek',value:targetSec},
    {currentTime:targetSec}
  ];
  for(const p of payloads){
    try{frame.contentWindow.postMessage(p,'*')}catch{}
    try{frame.contentWindow.postMessage(JSON.stringify(p),'*')}catch{}
  }
}

function populatePauseOverlay(movie){
  if(!movie)return;
  const logoEl=$('#pause-logo'),titleEl=$('#pause-title'),metaEl=$('#pause-meta'),synEl=$('#pause-synopsis');
  const isTV=isTvSeries(movie);
  const logoUrl=getMovieLogo(movie);
  if(titleEl)titleEl.textContent=movie.title.toUpperCase();
  if(logoEl&&titleEl){
    if(logoUrl){
      logoEl.src=logoUrl;
      logoEl.alt=movie.title;
      logoEl.hidden=false;
      titleEl.hidden=true;
      logoEl.onerror=()=>{logoEl.hidden=true;titleEl.hidden=false};
    }else{
      logoEl.hidden=true;
      logoEl.removeAttribute('src');
      titleEl.hidden=false;
      if(movie.tmdbId){
        hydrateLogosForMovies([movie]).then(()=>{
          if(activeMovie?.id===movie.id){
            const loadedLogo=getMovieLogo(movie);
            if(loadedLogo){
              logoEl.src=loadedLogo;
              logoEl.alt=movie.title;
              logoEl.hidden=false;
              titleEl.hidden=true;
            }
          }
        });
      }
    }
  }
  const primaryGenre=(movie.genres&&movie.genres[0])||String(movie.genre||'').split(',')[0].trim();
  const metaParts=[
    isTV?`Series`:`Film`,
    isTV?`S${currentSeason} · E${currentEpisode}`:'',
    primaryGenre,
    movie.year||'',
    movie.rating?`★ ${movie.rating.toFixed(1)}`:''
  ].filter(Boolean);
  const pauseAge=getMovieAgeRating(movie);
  if(metaEl){
    metaEl.innerHTML=metaParts.map(p=>`<span>${escapeHtml(p)}</span>`).join('<span class="meta-dot">·</span>')+(pauseAge?`<span class="age-rating-pill">${escapeHtml(pauseAge)}</span>`:'')+`<span class="quality-pill">HD</span>`;
  }
  if(synEl)synEl.textContent=movie.description||'';
}

function showPauseOverlay(){
  const overlay=$('#player-pause-overlay');
  if(!overlay||!activeMovie||!isPlayerActive())return;
  populatePauseOverlay(activeMovie);
  overlay.hidden=false;
}

function hidePauseOverlay(){
  const overlay=$('#player-pause-overlay');
  if(overlay)overlay.hidden=true;
}

$('#player-pause-overlay')?.addEventListener('click',()=>{
  hidePauseOverlay();
  const video=$('#video-player'),frame=$('#stream-player');
  if(video&&!video.hidden){
    video.play().catch(()=>{});
  }else if(frame){
    sendIframePlaybackCmd(frame,'play');
    try{frame.focus({preventScroll:true})}catch{}
  }
});

window.addEventListener('message',event=>{
  const frame=$('#stream-player');
  if(!activeMovie||event.source!==frame?.contentWindow)return;
  let payload=event.data;
  if(typeof payload==='string'){try{payload=JSON.parse(payload)}catch{}}
  if(!payload||typeof payload!=='object')return;
  const data=payload.data||payload;
  const isTV=isTvSeries(activeMovie);
  const evtName=String(payload.event||payload.type||data.event||data.player_status||data.status||'').toLowerCase();

  // Extract playback seconds/duration from PLAYER_EVENT, flat payloads, OR VidLink/VidFast MEDIA_DATA
  let seconds=Number(data.player_progress??data.currentTime??data.time??data.seconds??data.watched??payload.player_progress??payload.currentTime);
  let duration=Number(data.player_duration??data.duration??payload.player_duration??payload.duration);

  if((!Number.isFinite(seconds)||seconds<0)&&payload.type==='MEDIA_DATA'&&data&&typeof data==='object'){
    const mediaEntry=data[String(activeMovie.tmdbId)]||Object.values(data).find(v=>v&&typeof v==='object'&&(v.progress||v.show_progress));
    if(mediaEntry){
      if(isTV&&mediaEntry.show_progress){
        const epKey=`s${currentSeason}e${currentEpisode}`;
        const epObj=mediaEntry.show_progress[epKey];
        if(epObj?.progress){
          seconds=Number(epObj.progress.watched);
          duration=Number(epObj.progress.duration||duration);
        }
      }
      if((!Number.isFinite(seconds)||seconds<0)&&mediaEntry.progress){
        seconds=Number(mediaEntry.progress.watched);
        duration=Number(mediaEntry.progress.duration||duration);
      }
    }
  }

  // Enforce exact resume timestamp on initial play/timeupdate if server started at 0:00
  if(pendingResumeTarget&&pendingResumeTarget.movieId===activeMovie.id){
    const elapsedMs=Date.now()-pendingResumeTarget.startedAt;
    if(elapsedMs>15000){
      pendingResumeTarget=null;
    }else if(Number.isFinite(seconds)&&seconds>=pendingResumeTarget.time-8){
      pendingResumeTarget=null;
    }else if((evtName==='play'||evtName==='playing'||evtName==='timeupdate'||evtName==='loadedmetadata')&&(!Number.isFinite(seconds)||seconds<pendingResumeTarget.time-8)){
      if(pendingResumeTarget.seekAttempts<3){
        pendingResumeTarget.seekAttempts++;
        enforceIframeSeek(frame,pendingResumeTarget.time);
      }
      // Protect saved resume timestamp from being overwritten by initial 0:00 startup ticks
      if(Number.isFinite(seconds)&&seconds<=5){
        return;
      }
    }
  }

  if(typeof data.volume==='number'&&Number.isFinite(data.volume)){
    embedVolume=data.volume>1?Math.min(1,data.volume/100):Math.max(0,data.volume);
  }
  if(evtName==='play'||evtName==='playing'||(evtName==='timeupdate'&&Number.isFinite(seconds)&&seconds>1)||data.paused===false||data.playing===true){
    if(!playerHasStarted)unmuteIframePlayer(frame);
    playerHasStarted=true;
    embedIsPlaying=true;
    hidePauseOverlay();
  }else if(evtName==='pause'||evtName==='paused'||data.paused===true||data.playing===false){
    embedIsPlaying=false;
  }

  if(Number.isFinite(seconds)&&seconds>0){
    embedCurTime=Math.floor(seconds);
    if(Number.isFinite(duration)&&duration>0)embedDuration=Math.floor(duration);
    progressItems[activeMovie.id]=activeMovie;
    const isCompleted=data.player_status==='completed'||(Number.isFinite(duration)&&duration>0&&seconds>=duration-15);
    savePlaybackProgress(activeMovie.id,{
      season:isTV?currentSeason:undefined,
      episode:isTV?currentEpisode:undefined,
      time:Math.floor(seconds),
      duration:Number.isFinite(duration)&&duration>0?Math.floor(duration):0,
      completed:isCompleted
    });
  }
});
let activeModalMovie=null,activeModalContext=null,modalPreviewMuted=true;

function stopModalPreview(){
  activeModalContext=null;
  const wrap=$('#modal-video-wrap'),muteBtn=$('#modal-mute-btn');
  if(wrap){wrap.classList.remove('ready');wrap.innerHTML=''}
  if(muteBtn)muteBtn.hidden=true;
}

function closeMoreInfoModal({fromHistory=false}={}){
  stopModalPreview();
  activeModalMovie=null;
  const modal=$('#more-info-modal');
  if(modal&&modal.open)modal.close();
  if(!$$('dialog[open]').length)document.body.classList.remove('dialog-open');
  if(activeHeroContext?.iframe&&!$('#hero-section')?.hidden){
    sendYtCommand(activeHeroContext.iframe,'playVideo');
  }
  if(!fromHistory&&window.location.hash==='#modal'){
    history.back();
  }
}

function mountModalTrailer(ctx){
  if(!ctx||activeModalContext!==ctx)return;
  const {wrap,muteBtn,movie,keys}=ctx;
  while(ctx.index<keys.length&&failedTrailerKeys.has(keys[ctx.index]))ctx.index++;
  const key=keys[ctx.index];
  if(!key){wrap.innerHTML='';wrap.classList.remove('ready');if(muteBtn)muteBtn.hidden=true;return}
  wrap.innerHTML='';
  wrap.classList.remove('ready');
  const mutedParam=modalPreviewMuted?1:0;
  const originParam=encodeURIComponent(window.location.origin);
  const iframe=document.createElement('iframe');
  iframe.className='nf-modal-video-frame';
  iframe.title=`${movie.title} 1080p HD preview`;
  iframe.allow='autoplay; encrypted-media; picture-in-picture';
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  iframe.src=`https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&mute=${mutedParam}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&loop=1&playlist=${encodeURIComponent(key)}&enablejsapi=1&vq=hd1080&hd=1&origin=${originParam}`;
  ctx.iframe=iframe;
  ctx.currentKey=key;
  iframe.onload=()=>{
    if(activeModalContext!==ctx||ctx.iframe!==iframe)return;
    try{iframe.contentWindow?.postMessage(JSON.stringify({event:'listening',id:`modal-${ctx.id}`}),'*')}catch{}
    sendYtCommand(iframe,'setPlaybackQuality',['hd1080']);
    sendYtCommand(iframe,'setPlaybackQualityRange',['hd1080','hd1080']);
    sendYtCommand(iframe,'playVideo');
    if(modalPreviewMuted)sendYtCommand(iframe,'mute');
    else sendYtCommand(iframe,'unMute');
    setTimeout(()=>{if(activeModalContext===ctx&&ctx.iframe===iframe&&!failedTrailerKeys.has(key))wrap.classList.add('ready')},700);
  };
  wrap.appendChild(iframe);
  if(muteBtn){
    muteBtn.hidden=false;
    muteBtn.innerHTML=modalPreviewMuted?SVG_VOLUME_OFF:SVG_VOLUME_ON;
    muteBtn.setAttribute('aria-label',modalPreviewMuted?'Unmute preview':'Mute preview');
    muteBtn.title=modalPreviewMuted?'Unmute':'Mute';
    muteBtn.onclick=e=>{
      e.stopPropagation();
      modalPreviewMuted=!modalPreviewMuted;
      muteBtn.innerHTML=modalPreviewMuted?SVG_VOLUME_OFF:SVG_VOLUME_ON;
      muteBtn.setAttribute('aria-label',modalPreviewMuted?'Unmute preview':'Mute preview');
      muteBtn.title=modalPreviewMuted?'Unmute':'Mute';
      sendYtCommand(iframe,modalPreviewMuted?'mute':'unMute');
    };
  }
}

async function renderModalEpisodes(movie,seasonNum){
  const listEl=$('#modal-ep-list'),subEl=$('#modal-ep-submeta');
  if(!listEl||activeModalMovie?.id!==movie.id)return;
  const draw=(eps)=>{
    if(activeModalMovie?.id!==movie.id)return;
    const age=getMovieAgeRating(movie);
    if(subEl){
      subEl.innerHTML=`<span>Season ${seasonNum}</span>${age?`<span class="age-rating-pill">${escapeHtml(age)}</span>`:''}<span>${eps.length} ${eps.length===1?'Episode':'Episodes'}</span>`;
    }
    listEl.innerHTML=eps.map(ep=>{
      const thumb=ep.still||movie.backdrop||movie.poster||'';
      return `<article class="nf-modal-ep-row" data-season="${seasonNum}" data-episode="${ep.number}" role="button" tabindex="0">
        <span class="nf-modal-ep-num">${ep.number}</span>
        <div class="nf-modal-ep-thumb">
          ${thumb?`<img src="${escapeHtml(thumb)}" alt="${escapeHtml(ep.name)}" loading="lazy" />`:''}
          <div class="nf-modal-ep-play"><span>${SVG_PLAY}</span></div>
        </div>
        <div class="nf-modal-ep-info">
          <div class="nf-modal-ep-top">
            <h4 class="nf-modal-ep-title">${escapeHtml(ep.name||`Episode ${ep.number}`)}</h4>
            ${ep.runtime?`<span class="nf-modal-ep-dur">${ep.runtime}m</span>`:''}
          </div>
          <p class="nf-modal-ep-desc">${escapeHtml(ep.overview||'Watch this episode on MovieBox.')}</p>
        </div>
      </article>`;
    }).join('');
    listEl.querySelectorAll('.nf-modal-ep-row').forEach(row=>{
      const launch=()=>{
        const s=Number(row.dataset.season)||1,e=Number(row.dataset.episode)||1;
        closeMoreInfoModal();
        openDetailPage(movie,{autoplay:false});
        playMovie(movie,{season:s,episode:e});
      };
      row.onclick=launch;
      row.onkeydown=evt=>{if(evt.key==='Enter'||evt.key===' '){evt.preventDefault();launch()}};
    });
  };
  draw(getAvailableEpisodes(movie,seasonNum));
  if(!movie.seasonEpisodes?.[seasonNum]&&movie.source==='TMDB'&&movie.tmdbId){
    const fetched=await fetchSeasonEpisodes(movie,seasonNum);
    if(activeModalMovie?.id===movie.id&&fetched.length)draw(getAvailableEpisodes(movie,seasonNum));
  }
}

function openMoreInfoModal(movie){
  const modal=$('#more-info-modal');
  if(!movie||!modal)return;
  hideHoverCard();
  stopModalPreview();
  if(activeHeroContext?.iframe)sendYtCommand(activeHeroContext.iframe,'pauseVideo');
  activeModalMovie=movie;
  const isTV=isTvSeries(movie);

  const rawImg=movie.backdrop||movie.poster||'';
  const img=rawImg.includes('image.tmdb.org/t/p/w500')?rawImg.replace('/t/p/w500','/t/p/w1280'):rawImg;
  const backdropEl=$('#modal-backdrop');
  if(backdropEl){backdropEl.src=img;backdropEl.alt=movie.title}

  const logoEl=$('#modal-logo'),titleEl=$('#modal-title');
  const applyModalLogo=(url)=>{
    if(!logoEl||!titleEl)return;
    if(url){
      logoEl.src=url;logoEl.alt=movie.title;logoEl.hidden=false;titleEl.hidden=true;
      logoEl.onerror=()=>{logoEl.hidden=true;titleEl.hidden=false};
    }else{
      logoEl.hidden=true;logoEl.removeAttribute('src');titleEl.textContent=movie.title;titleEl.hidden=false;
    }
  };
  const existingLogo=getMovieLogo(movie);
  applyModalLogo(existingLogo);
  if(!existingLogo&&movie.tmdbId){
    hydrateLogosForMovies([movie]).then(()=>{
      if(activeModalMovie?.id===movie.id){
        const loaded=getMovieLogo(movie);
        if(loaded)applyModalLogo(loaded);
      }
    });
  }

  const playBtn=$('#modal-play');
  if(playBtn)playBtn.onclick=()=>{closeMoreInfoModal();openDetailPage(movie,{autoplay:true})};

  const saveBtn=$('#modal-save');
  const syncModalSave=()=>{
    if(!saveBtn)return;
    const isS=saved.has(movie.id);
    saveBtn.classList.toggle('saved',isS);
    saveBtn.innerHTML=isS?SVG_CHECK:SVG_PLUS;
    saveBtn.title=isS?'In My List':'Add to My List';
  };
  syncModalSave();
  if(saveBtn)saveBtn.onclick=()=>{toggleSavedTitle(movie);syncModalSave()};

  const renderModalMeta=()=>{
    const metaRow=$('#modal-meta-row'),ageRow=$('#modal-age-row'),synEl=$('#modal-synopsis');
    const genres=(movie.genres&&movie.genres.length?movie.genres:String(movie.genre||'').split(',').map(s=>s.trim())).filter(Boolean);
    const age=getMovieAgeRating(movie);
    const seasonsText=isTV&&movie.numberOfSeasons?`${movie.numberOfSeasons} ${movie.numberOfSeasons===1?'Season':'Seasons'}`:(movie.duration||'');
    if(metaRow){
      metaRow.innerHTML=`
        ${movie.year?`<span>${movie.year}</span>`:''}
        ${seasonsText?`<span>${escapeHtml(seasonsText)}</span>`:''}
        ${movie.rating?`<span class="match-score">★ ${movie.rating.toFixed(1)}</span>`:''}
        <span class="quality-pill">HD</span>
      `;
    }
    if(ageRow){
      if(age){
        ageRow.hidden=false;
        ageRow.innerHTML=`<span class="age-rating-pill">${escapeHtml(age)}</span><span>${escapeHtml(genres.slice(0,3).join(', '))}</span>`;
      }else{
        ageRow.hidden=true;
      }
    }
    if(synEl)synEl.textContent=movie.description||'';
    const gWrap=$('#modal-genres-wrap'),gEl=$('#modal-genres');
    if(gWrap&&gEl){gWrap.hidden=!genres.length;gEl.textContent=genres.join(', ')}
    const tWrap=$('#modal-tags-wrap'),tEl=$('#modal-tags');
    if(tWrap&&tEl){tWrap.hidden=false;tEl.textContent=isTV?'TV Series, Streaming in HD':'Feature Film, Streaming in HD'}
  };
  renderModalMeta();

  const cWrap=$('#modal-cast-wrap'),cEl=$('#modal-cast');
  if(cWrap)cWrap.hidden=true;

  const epSec=$('#modal-episodes-section'),sSel=$('#modal-season-select');
  if(epSec)epSec.hidden=!isTV;

  showDialog(modal);
  if(window.location.hash!=='#modal'){
    history.pushState({view:'modal',id:movie.id},'','#modal');
  }
  modal.scrollTop=0;
  setTimeout(()=>{
    const mp=$('#modal-play');
    if(mp){mp.focus({preventScroll:true});mp.classList.add('tv-focus')}
  },80);

  // Auto-play 1080p HD trailer inside modal header
  if(movie.tmdbId){
    const type=isTV?'tv':'movie';
    const cacheKey=`${type}-${movie.tmdbId}`;
    getTrailerCandidates(movie).then(keys=>{
      if(activeModalMovie?.id!==movie.id||!keys.length)return;
      const wrap=$('#modal-video-wrap'),muteBtn=$('#modal-mute-btn');
      if(!wrap)return;
      const ctx={id:movie.id,wrap,muteBtn,movie,keys,cacheKey,index:0,iframe:null,currentKey:'',isModal:true};
      activeModalContext=ctx;
      mountModalTrailer(ctx);
    });

    // Fetch full cast, duration/seasons, and age rating
    (async()=>{
      try{
        let r=await fetch(`/api/title/${type}/${movie.tmdbId}`);
        if(!r.ok)r=await fetch(`/api/title?type=${type}&id=${movie.tmdbId}`);
        if(!r.ok)return;
        const d=await r.json();
        if(!d||activeModalMovie?.id!==movie.id)return;
        if(d.ageRating)setMovieAgeRating(movie,d.ageRating);
        if(d.genres?.length){movie.genres=d.genres.map(g=>g.name);movie.genre=movie.genres.join(', ')}
        if(d.overview)movie.description=d.overview;
        if(isTV){
          movie.numberOfSeasons=d.number_of_seasons||(d.seasons?.filter(s=>s.season_number>0).length)||1;
          movie.numberOfEpisodes=d.number_of_episodes||24;
          movie.seasons=d.seasons||[];
          const seasons=getAvailableSeasons(movie);
          if(sSel&&seasons.length){
            const curS=Number(progress[movie.id]?.season)||seasons[0].season_number;
            sSel.innerHTML=seasons.map(s=>`<option value="${s.season_number}">${escapeHtml(s.name||`Season ${s.season_number}`)}</option>`).join('');
            sSel.value=String(curS);
            sSel.onchange=()=>renderModalEpisodes(movie,Number(sSel.value)||1);
            renderModalEpisodes(movie,curS);
          }
        }else if(d.runtime){
          movie.duration=`${Math.floor(d.runtime/60)}h ${d.runtime%60}m`;
        }
        const castList=(d.credits?.cast||d.aggregate_credits?.cast||[]).slice(0,6).map(p=>p.name).filter(Boolean);
        if(cWrap&&cEl&&castList.length){
          cEl.textContent=castList.join(', ');
          cWrap.hidden=false;
        }
        renderModalMeta();
      }catch{}
    })();
  }
}

$('#modal-close')?.addEventListener('click',closeMoreInfoModal);
$('#more-info-modal')?.addEventListener('close',()=>{
  stopModalPreview();
  activeModalMovie=null;
  if(!$$('dialog[open]').length)document.body.classList.remove('dialog-open');
  if(activeHeroContext?.iframe&&!$('#hero-section')?.hidden){
    sendYtCommand(activeHeroContext.iframe,'playVideo');
  }
});

let heroMovies=[],heroIndex=0,heroTimer=null;
function updateHeroDots(){const dotsContainer=$('#hero-dots');if(!dotsContainer||!heroMovies.length)return;const count=Math.min(5,heroMovies.length);let html='';for(let i=0;i<count;i++)html+=`<button type="button" class="hero-dot ${i===heroIndex?'active':''}" data-hero-index="${i}" aria-label="Go to slide ${i+1}"></button>`;dotsContainer.innerHTML=html;dotsContainer.querySelectorAll('[data-hero-index]').forEach(dot=>{dot.onclick=e=>{e.stopPropagation();setHeroMovie(Number(dot.dataset.heroIndex));restartHeroCarousel()}})}
function setHeroMovie(idx){
  if(!heroMovies.length)return;
  const count=Math.min(5,heroMovies.length);
  heroIndex=((idx%count)+count)%count;
  const item=heroMovies[heroIndex];
  if(!item)return;
  const titleEl=$('#hero-title'),logoEl=$('#hero-logo'),descEl=$('#hero-description'),kindEl=$('#hero-kind'),genreEl=$('#hero-genre'),yearEl=$('#hero-year'),ratingEl=$('#hero-rating'),ageEl=$('#hero-age-rating'),captionEl=$('#hero-caption'),playBtn=$('#hero-play'),infoBtn=$('#hero-info'),artEl=$('.hero-art');
  const isTV=isTvSeries(item);
  const primaryGenre=(item.genres&&item.genres[0])||String(item.genre||'').split(',')[0].trim()||(isTV?'Drama':'Feature');
  const heroLogoUrl=getMovieLogo(item);
  const heroAge=getMovieAgeRating(item);
  if(ageEl){
    if(heroAge){
      ageEl.textContent=heroAge;
      ageEl.hidden=false;
    }else{
      ageEl.textContent='';
      ageEl.hidden=true;
    }
  }
  if(titleEl)titleEl.textContent=item.title.toUpperCase();
  if(logoEl&&titleEl){
    if(heroLogoUrl){
      logoEl.src=heroLogoUrl;
      logoEl.alt=item.title;
      logoEl.hidden=false;
      titleEl.hidden=true;
      logoEl.onerror=()=>{
        logoEl.hidden=true;
        titleEl.hidden=false;
      };
    }else{
      logoEl.hidden=true;
      logoEl.removeAttribute('src');
      titleEl.hidden=false;
    }
  }
  if(descEl)descEl.textContent=item.description||'';
  if(kindEl)kindEl.textContent=isTV?'Series':'Film';
  if(genreEl)genreEl.textContent=primaryGenre;
  if(yearEl)yearEl.textContent=item.year||'2026';
  if(ratingEl)ratingEl.textContent=item.rating?`★ ${item.rating.toFixed(1)}`:'HD';
  if(captionEl){
    const snippet=(item.description||'').split(/(?<=[.!?])\s+/)[0]||'';
    captionEl.textContent=snippet.length>68?`${snippet.slice(0,65).trim()}…`:(snippet||'Trending on MovieBox');
  }
  if(playBtn){
    playBtn.innerHTML=`<span class="play-triangle">${SVG_PLAY}</span> Play`;
    playBtn.onclick=()=>openDetailPage(item,{autoplay:true});
  }
  if(infoBtn){
    infoBtn.textContent='More info';
    infoBtn.onclick=()=>openMoreInfoModal(item);
  }
  if(artEl){
    const artUrl=item.backdrop||item.poster||'';
    artEl.style.backgroundImage=artUrl?`url('${artUrl}')`:'';
    artEl.setAttribute('aria-label',`${item.title} backdrop`);
  }
  updateHeroDots();
  scheduleHeroPreview(item);
}
function startHeroCarousel(){stopHeroCarousel();if(heroMovies.length>1)heroTimer=setInterval(()=>setHeroMovie(heroIndex+1),18000)}
function stopHeroCarousel(){if(heroTimer){clearInterval(heroTimer);heroTimer=null}}
function restartHeroCarousel(){stopHeroCarousel();startHeroCarousel()}
function setupHeroCarousel(items){const uniqueItems=getUniqueMovies(items);const withBackdrop=uniqueItems.filter(m=>m.backdrop);const pool=withBackdrop.length>=3?withBackdrop:uniqueItems;heroMovies=pool.slice(0,5);heroIndex=0;if(heroMovies.length){setHeroMovie(0);startHeroCarousel()}}
setupHeroCarousel(movies);
const heroSection=$('#hero-section')||$('.hero');
heroSection?.addEventListener('mouseenter',stopHeroCarousel);
heroSection?.addEventListener('mouseleave',startHeroCarousel);
heroSection?.addEventListener('touchstart',stopHeroCarousel,{passive:true});
heroSection?.addEventListener('touchend',startHeroCarousel,{passive:true});

window.addEventListener('scroll',()=>{
  if(document.body.classList.contains('vidaa-tv'))return;
  const bar=$('#topbar')||$('.topbar');
  if(bar)bar.classList.toggle('scrolled',window.scrollY>16);
},{passive:true});

const navBrowseBtn=$('#nav-browse-btn');
if(navBrowseBtn){
  navBrowseBtn.onclick=()=>{
    const discover=$('#discover');
    if(!discover)return;
    if(currentView==='saved'||currentView==='detail'||currentView==='recent'){
      switchView('home');
    }
    const willOpen=discover.hidden;
    discover.hidden=!willOpen;
    navBrowseBtn.setAttribute('aria-expanded',willOpen?'true':'false');
    if(willOpen){
      discover.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
  };
}
['genre-filter','year-filter','sort-filter','media-type','availability-filter','region-filter'].forEach(id=>{const el=$('#'+id);if(el)el.onchange=()=>{recentListMode=false;if(id==='media-type')homeMixedMode=false;return catalog.some(m=>m.source==='TMDB')?loadTMDBCatalog(searchInput?.value.trim()||'',1).catch(err=>notify(err.message)):render()}});
const clearFiltersBtn=$('#clear-filters');if(clearFiltersBtn)clearFiltersBtn.onclick=()=>{$('#genre-filter').value='all';$('#year-filter').value='all';$('#sort-filter').value='featured';recentListMode=false;homeMixedMode=!isListView;if(catalog.some(m=>m.source==='TMDB'))loadTMDBCatalog(searchInput?.value.trim()||'',1).catch(err=>notify(err.message));else render()};
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close)?.close());$$('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d)d.close()});d.addEventListener('close',()=>{if(!$$('dialog[open]').length)document.body.classList.remove('dialog-open')})});
let searchTimer,searchRequest=0;const searchInput=$('#search-input'),searchBox=$('#search-box'),searchClose=$('#search-close'),searchToggle=$('#search-toggle')||$('.search-toggle');function openSearch(){searchBox?.classList.add('open');searchInput?.focus()}function closeSearch(){if(!searchInput)return;const had=searchInput.value.trim().length>0;searchInput.value='';searchBox?.classList.remove('open');render();if(had&&catalog.some(m=>m.source==='TMDB'))refreshTMDBCatalog('')}searchToggle?.addEventListener('click',()=>{if(searchBox?.classList.contains('open'))closeSearch();else openSearch()});searchClose?.addEventListener('click',closeSearch);searchInput?.addEventListener('input',()=>{recentListMode=false;render();if(catalog.some(m=>m.source==='TMDB')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshTMDBCatalog(searchInput.value.trim()),320)}});searchInput?.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearch()});
$$('.see-all').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();recentListMode=link.id==='recent-see-all';isListView=true;render();scrollToList()}));
$$('[data-view]').forEach(link=>link.addEventListener('click',e=>{
  const view=link.dataset.view;
  const mediaType=link.dataset.mediaType;
  if(view==='saved'){
    e.preventDefault();
    history.pushState(null,'','#my-list');
    switchView('saved');
  }else if(view==='home'){
    e.preventDefault();
    history.pushState(null,'','#home');
    isListView=false;
    recentListMode=false;
    homeMixedMode=true;
    switchView('home');
  }else if(view==='recent'){
    e.preventDefault();
    history.pushState(null,'','#new-popular');
    switchView('recent');
  }else if(view==='discover'){
    e.preventDefault();
    isListView=true;
    recentListMode=false;
    switchView('discover');
  }else if(view==='movies'||view==='tv'){
    e.preventDefault();
    history.pushState(null,'',view==='tv'?'#series':'#films');
    switchView(view);
  }
}));
$('#my-list-browse-btn')?.addEventListener('click',()=>{history.pushState(null,'','#home');switchView('home')});
$('#detail-back')?.addEventListener('click',()=>{
  stopPlayer();
  if(window.history.length>1&&window.location.hash.startsWith('#title/')){
    history.back();
  }else{
    history.pushState(null,'','#home');
    switchView('home');
  }
});
$('#player-close')?.addEventListener('click',stopPlayer);
function handleRoute(){
  const hash=window.location.hash;
  if(!hash.startsWith('#watch/')&&isFullscreenPlayerActive()){
    exitFullscreenPlayer({fromHistory:true});
    return;
  }
  const modal=$('#more-info-modal');
  if(hash!=='#modal'&&modal&&modal.open){
    closeMoreInfoModal({fromHistory:true});
  }
  if(hash==='#modal'||hash.startsWith('#watch/')){return}
  if(hash==='#my-list'){switchView('saved')}
  else if(hash==='#new-popular'){switchView('recent')}
  else if(hash==='#series'){switchView('tv')}
  else if(hash==='#films'){switchView('movies')}
  else if(hash.startsWith('#title/')){
    const id=decodeURIComponent(hash.slice('#title/'.length));
    const movie=findMovieById(id);
    if(movie)openDetailPage(movie,{skipPush:true});
    else switchView('home');
  }else if(hash==='#home'||!hash){
    if(currentView!=='home')switchView('home');
  }else if(hash==='#discover'){
    if(currentView==='saved'||currentView==='detail')switchView('discover');
  }
}
window.addEventListener('hashchange',handleRoute);
window.addEventListener('popstate',handleRoute);
$('#server-settings').onclick=()=>{const cfg=JSON.parse(localStorage.getItem('wath32-server')||'{}');$('#server-url').value=cfg.url||'';$('#server-token').value=cfg.token||'';showDialog($('#server-dialog'))};$('#server-form').onsubmit=async e=>{e.preventDefault();const url=$('#server-url').value.trim(),token=$('#server-token').value.trim();if(!url){localStorage.removeItem('wath32-server');catalog=[...movies];refreshFilterOptions();$('#server-dialog').close();render();loadInternetArchive();return}if(/\.(m3u8|mp4|webm)(\?|$)/i.test(url)){$('#server-dialog').close();const directItem={id:`direct-${Date.now()}`,title:'Direct Stream',year:2026,genre:'Stream',duration:'',description:'Playing direct stream in MovieBox Native HLS Player.',poster:'',backdrop:'',videoUrl:url,hlsUrl:/\.m3u8(\?|$)/i.test(url)?url:'',source:'Direct'};openDetailPage(directItem,{autoplay:true});return}localStorage.setItem('wath32-server',JSON.stringify({url,token}));try{const res=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!res.ok)throw Error(`Server returned ${res.status}`);const data=await res.json();if(!Array.isArray(data))throw Error('Catalog response must be a JSON array');catalog=data.map((m,i)=>({...m,id:String(m.id??`server-${i}`),year:Number(m.year)||2025,rating:Number(m.rating)||0,genre:m.genre||'Film',duration:m.duration||'',description:m.description||'',poster:m.poster||'',videoUrl:m.videoUrl||'',hlsUrl:m.hlsUrl||'',subtitlesUrl:m.subtitlesUrl||''}));currentPage=1;totalPages=1;totalResults=catalog.length;refreshFilterOptions();$('#server-dialog').close();render();notify(`Connected · ${catalog.length} titles`)}catch(err){notify(`Couldn’t connect: ${err.message}`)}};
function formatDuration(value){if(!value)return'';const mins=Math.round(parseFloat(String(value).replace(/[^0-9.]/g,''))*60);return Number.isFinite(mins)&&mins?`${Math.floor(mins/60)}h ${mins%60}m`:String(value)}
function stripHtml(value){if(!value)return'';const el=document.createElement('div');el.innerHTML=String(value);return(el.textContent||'').trim().slice(0,600)}
async function loadInternetArchive(){try{const fields=['identifier','title','year','description','creator','subject','runtime'];const params=new URLSearchParams({q:'collection:feature_films AND mediatype:movies',rows:'40',page:'1',output:'json'});fields.forEach(f=>params.append('fl[]',f));const res=await fetch(`https://archive.org/advancedsearch.php?${params}`);if(!res.ok)throw Error(`Catalog returned ${res.status}`);const payload=await res.json(),docs=payload.response?.docs||[];const items=await Promise.all(docs.slice(0,30).map(async d=>{try{const mr=await fetch(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`);if(!mr.ok)return null;const meta=await mr.json(),files=meta.files||[];const mp4Files=files.filter(f=>/\.mp4$/i.test(f.name||'')&&!f.name?.includes('__ia_thumb'));if(!mp4Files.length)return null;mp4Files.sort((a,b)=>(Number(b.height)||0)-(Number(a.height)||0)||(Number(b.size)||0)-(Number(a.size)||0));const video=mp4Files[0],qMap={};for(const f of mp4Files){const h=Number(f.height)||0,fUrl=`https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(f.name)}`;if(h>=1000&&!qMap['1080'])qMap['1080']=fUrl;else if(h>=700&&!qMap['720'])qMap['720']=fUrl;else if(h>=400&&!qMap['480'])qMap['480']=fUrl}if(!Object.keys(qMap).length){qMap['1080']=`https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(video.name)}`}const title=Array.isArray(d.title)?d.title[0]:d.title,subjects=Array.isArray(d.subject)?d.subject:typeof d.subject==='string'?d.subject.split(';'):[],genre=subjects.find(s=>/drama|comedy|horror|western|adventure|science fiction|documentary|thriller/i.test(s))||'Classic film',description=Array.isArray(d.description)?d.description[0]:d.description;return{id:String(d.identifier),title:title||d.identifier,year:Number((Array.isArray(d.year)?d.year[0]:d.year)||meta.metadata?.year)||0,genre:genre.split(/[,;]/)[0].trim(),rating:0,duration:formatDuration(d.runtime||meta.metadata?.runtime),poster:`https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,description:stripHtml(description)||'A film from the Internet Archive feature film collection.',videoUrl:qMap['1080']||`https://archive.org/download/${encodeURIComponent(d.identifier)}/${encodeURIComponent(video.name)}`,qualityUrls:qMap,source:'Internet Archive',license:meta.metadata?.licenseurl||'Check item record'}}catch{return null}}));catalog=items.filter(Boolean);if(!catalog.length)throw Error('No playable MP4 films were found in this collection');currentPage=1;totalPages=1;totalResults=catalog.length;refreshFilterOptions();setupHeroCarousel(catalog);render();notify(`Loaded ${catalog.length} classic films in Full HD`)}catch(err){console.warn('Internet Archive catalog unavailable',err);notify('Free catalog unavailable · Showing demo titles')}}
async function refreshTMDBCatalog(query='',page=1){
  const request=++searchRequest;
  currentPage=page;
  const useMixedHome=homeMixedMode&&!isListView&&!query&&page===1&&$('#genre-filter').value==='all'&&$('#year-filter').value==='all'&&$('#availability-filter').value==='all'&&$('#sort-filter').value==='featured';
  const params=new URLSearchParams({page:String(page),genre:$('#genre-filter').value,year:$('#year-filter').value,sort:$('#sort-filter').value,type:useMixedHome?'all':$('#media-type').value,availability:$('#availability-filter').value,region:$('#region-filter').value});
  if(query)params.set('query',query);
  const res=await fetch(`/api/catalog?${params}`,{cache:'no-store'});
  if(!res.ok){const detail=await res.json().catch(()=>({}));throw Error(detail.error||'TMDB catalog is unavailable')}
  const payload=await res.json();
  if(request!==searchRequest)return;
  if(!payload.results?.length&&query){catalog=[];totalPages=1;totalResults=0;render();return}
  if(!payload.results?.length)throw Error('TMDB returned no titles for these filters');
  catalog=getUniqueMovies(payload.results);
  if(payload.homeShelves&&typeof payload.homeShelves==='object'){
    homeShelves=payload.homeShelves;
    Object.values(homeShelves).forEach(list=>{
      if(Array.isArray(list))list.forEach(m=>{if(m&&saved.has(m.id))savedItems[m.id]=m});
    });
  }
  if(Array.isArray(payload.recentResults)){
    recentCatalog=getUniqueMovies(payload.recentResults);
    recentCatalog.forEach(m=>{if(saved.has(m.id))savedItems[m.id]=m});
  }
  catalog.forEach(m=>{if(saved.has(m.id))savedItems[m.id]=m});
  persist();
  currentPage=payload.page||page;
  totalPages=payload.totalPages||1;
  totalResults=payload.total||catalog.length;
  refreshFilterOptions();
  if(!query&&currentPage===1&&$('#genre-filter').value==='all'&&$('#year-filter').value==='all'){
    setupHeroCarousel(catalog);
    reshuffleEveningPicks(catalog);
  }
  render();
}
async function loadTMDBCatalog(query='',page=1){
  await refreshTMDBCatalog(query,page);
}
function toggleFullscreen(){
  const stage=$('#player-stage'),video=$('#video-player'),frame=$('#stream-player'),target=video&&!video.hidden?video:(frame||stage);
  if(!target)return;
  try{
    if(!document.fullscreenElement&&!document.webkitFullscreenElement){
      if(target.requestFullscreen){target.requestFullscreen().catch(()=>{try{stage?.requestFullscreen?.().catch(()=>{})}catch{}})}
      else if(target.webkitRequestFullscreen){target.webkitRequestFullscreen()}
      else if(stage?.requestFullscreen){stage.requestFullscreen().catch(()=>{})}
    }else{
      if(document.exitFullscreen){document.exitFullscreen().catch(()=>{})}
      else if(document.webkitExitFullscreen){document.webkitExitFullscreen()}
    }
  }catch{}
}
$('#player-fullscreen')?.addEventListener('click',toggleFullscreen);
(function initPlayerScrollPassThrough(){
  let scrollUnlockTimer=null;
  const unlockPlayerScroll=()=>{
    const wrap=$('.player-media-wrap');
    if(!wrap||!isPlayerActive())return;
    wrap.classList.add('is-scrolling');
    clearTimeout(scrollUnlockTimer);
    scrollUnlockTimer=setTimeout(()=>wrap.classList.remove('is-scrolling'),260);
  };
  window.addEventListener('wheel',unlockPlayerScroll,{passive:true});
  window.addEventListener('scroll',unlockPlayerScroll,{passive:true});
})();

/* ==========================================================================
   Smart TV / VIDAA OS Spatial Navigation & Magnetic Pointer Focus Snap
   ========================================================================== */
(function initTvSpatialNav(){
  const FOCUS_SELECTOR=[
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '.nf-card',
    '.nf-top10-poster',
    '.movie-card',
    '.nf-modal-ep-row'
  ].join(',');

  function animateWindowScrollY(targetY){
    const maxY=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    const clampedY=Math.max(0,Math.min(maxY,Math.round(targetY)));
    try{window.scrollTo({top:clampedY,behavior:'smooth'})}catch{window.scrollTo(0,clampedY)}
  }

  function scrollPageByY(deltaY){
    const openDialog=document.querySelector('dialog[open]');
    if(openDialog){
      const maxTop=Math.max(0,openDialog.scrollHeight-openDialog.clientHeight);
      const targetTop=Math.max(0,Math.min(maxTop,Math.round(openDialog.scrollTop+deltaY)));
      try{openDialog.scrollTo({top:targetTop,behavior:'smooth'})}catch{openDialog.scrollTop=targetTop}
      return;
    }
    const curY=window.pageYOffset||document.documentElement.scrollTop||0;
    animateWindowScrollY(curY+deltaY);
  }

  function animateTrackScrollX(track,targetX){
    if(!track)return;
    const maxX=Math.max(0,track.scrollWidth-track.clientWidth);
    const clampedX=Math.max(0,Math.min(maxX,Math.round(targetX)));
    try{track.scrollTo({left:clampedX,behavior:'smooth'})}catch{track.scrollLeft=clampedX}
  }

  function smoothFocusScroll(el,dir){
    if(!el)return;
    const openDialog=document.querySelector('dialog[open]');
    if(openDialog){
      try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
      return;
    }
    const rect=el.getBoundingClientRect();
    const track=el.closest('.nf-row-track');
    if(track&&(dir==='left'||dir==='right')){
      const tRect=track.getBoundingClientRect();
      const targetX=track.scrollLeft+(rect.left-tRect.left)-(tRect.width-rect.width)/2;
      animateTrackScrollX(track,targetX);
    }
    if(dir==='up'||dir==='down'||!track){
      const currentY=window.pageYOffset||document.documentElement.scrollTop||0;
      const targetY=currentY+rect.top-(window.innerHeight-rect.height)/2;
      animateWindowScrollY(targetY);
    }
  }

  function isExcludedFromTvFocus(el){
    if(!el)return true;
    return el.matches('.brand, .footer-brand, .hero-dot')||Boolean(el.closest('footer'));
  }

  let lastTvFocused=null;

  function setTvFocusRing(el){
    if(el&&isExcludedFromTvFocus(el))el=null;
    if(lastTvFocused&&lastTvFocused!==el)lastTvFocused.classList.remove('tv-focus');
    lastTvFocused=el||null;
    if(el)el.classList.add('tv-focus');
  }

  function isElementVisible(el){
    if(!el||isExcludedFromTvFocus(el)||el.hidden||el.closest('[hidden]'))return false;
    const style=window.getComputedStyle(el);
    if(style.display==='none'||style.visibility==='hidden'||style.pointerEvents==='none')return false;
    const r=el.getBoundingClientRect();
    return r.width>4&&r.height>4;
  }

  function getNavScope(){
    if(isNativeVideoActive()&&isNativeHudVisible()){
      const nhud=$('#native-player-hud');
      if(nhud)return nhud;
    }
    const openDialog=document.querySelector('dialog[open]');
    if(openDialog)return openDialog;
    return document.body;
  }

  function getFocusableList(){
    const scope=getNavScope();
    return [...scope.querySelectorAll(FOCUS_SELECTOR)].filter(isElementVisible);
  }

  function findNextSpatialTarget(current,dir){
    // O(1) fast-path for horizontal D-pad navigation inside any carousel row (instant reaction on TV)
    const curTrack=current?.closest?.('.nf-row-track');
    if(curTrack&&(dir==='left'||dir==='right')){
      const items=[...curTrack.querySelectorAll('.nf-card, .nf-top10-poster')];
      const idx=items.indexOf(current);
      if(idx!==-1){
        const nextIdx=dir==='right'?idx+1:idx-1;
        if(nextIdx>=0&&nextIdx<items.length)return items[nextIdx];
      }
    }
    // O(1) fast-path for vertical D-pad jumps between adjacent carousel rows
    const curRow=current?.closest?.('.nf-row-section');
    if(curRow&&(dir==='up'||dir==='down')){
      const adjRow=dir==='down'?curRow.nextElementSibling:curRow.previousElementSibling;
      if(adjRow&&adjRow.classList.contains('nf-row-section')){
        const adjItems=[...adjRow.querySelectorAll('.nf-card, .nf-top10-poster')];
        if(adjItems.length){
          const cx=current.getBoundingClientRect().left;
          let bestItem=adjItems[0],bestDx=Infinity;
          for(const item of adjItems){
            const d=Math.abs(item.getBoundingClientRect().left-cx);
            if(d<bestDx){bestDx=d;bestItem=item}
          }
          return bestItem;
        }
      }
    }

    const candidates=getFocusableList().filter(el=>el!==current);
    if(!candidates.length)return null;
    if(!current||!isElementVisible(current))return candidates[0];

    const cRect=current.getBoundingClientRect();
    const cx=cRect.left+cRect.width/2;
    const cy=cRect.top+cRect.height/2;

    let best=null,bestScore=Infinity;
    for(const el of candidates){
      const r=el.getBoundingClientRect();
      const tx=r.left+r.width/2;
      const ty=r.top+r.height/2;
      const dx=tx-cx;
      const dy=ty-cy;

      let primary=0,secondary=0;
      if(dir==='right'){if(dx<=6)continue;primary=dx;secondary=Math.abs(dy)}
      else if(dir==='left'){if(dx>=-6)continue;primary=-dx;secondary=Math.abs(dy)}
      else if(dir==='down'){if(dy<=6)continue;primary=dy;secondary=Math.abs(dx)}
      else if(dir==='up'){if(dy>=-6)continue;primary=-dy;secondary=Math.abs(dx)}

      const score=primary+secondary*2.6;
      if(score<bestScore){
        bestScore=score;
        best=el;
      }
    }
    return best;
  }

  // Detect Hisense VIDAA OS TV environment or ?tv=vidaa launcher flag
  const isVidaaTv=new URLSearchParams(window.location.search).get('tv')==='vidaa'||/VIDAA|Hisense/i.test(navigator.userAgent||'');
  if(isVidaaTv){
    document.body.classList.add('vidaa-tv');
    setTimeout(()=>{
      const initialTarget=$('#hero-play')||$('.nav-link.active');
      if(initialTarget&&isElementVisible(initialTarget)){
        initialTarget.focus({preventScroll:true});
        setTvFocusRing(initialTarget);
      }
    },350);
  }

  function handleTvBack(){
    if(isFullscreenPlayerActive()){
      exitFullscreenPlayer();
      return true;
    }
    const frame=$('#stream-player');
    if(document.activeElement===frame){try{frame.blur()}catch{}}
    const modal=$('#more-info-modal');
    if(modal&&modal.open){closeMoreInfoModal();return true}
    if(activeHoverId){hideHoverCard();return true}
    if(searchBox?.classList.contains('open')){closeSearch();return true}
    if(currentView==='detail'){
      stopPlayer();
      if(window.history.length>1&&window.location.hash.startsWith('#title/')){
        history.back();
      }else{
        history.pushState(null,'','#home');
        switchView('home');
      }
      return true;
    }
    if(currentView!=='home'){
      history.pushState(null,'','#home');
      switchView('home');
      return true;
    }
    if(isVidaaTv&&typeof window.Hisense_Exit==='function'){
      try{window.Hisense_Exit()}catch{}
      return true;
    }
    return false;
  }

  // 1. Capture-phase Hisense VIDAA Remote Handler (Back, Fullscreen Netflix HUD, Channel Scroll & D-Pad)
  window.addEventListener('keydown',e=>{
    const activeEl=document.activeElement;
    const tag=activeEl?.tagName;
    const isTyping=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
    const kc=e.keyCode||e.which||0;

    // A. VIDAA / Smart TV Remote BACK button (always exits fullscreen first, then modal/detail/view)
    const isBackKey=(
      kc===461||kc===10009||kc===166||kc===27||
      (kc===8&&!isTyping)||
      e.key==='Escape'||e.key==='BrowserBack'||e.key==='GoBack'||e.key==='Back'||e.key==='XF86Back'||
      (e.key==='Backspace'&&!isTyping)
    )&&!e.metaKey&&!e.ctrlKey;
    if(isBackKey){
      if(handleTvBack()){
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // B. Fullscreen Player Remote Control:
    //    - Native HTML5/HLS <video>: full Netflix TV D-Pad HUD
    //    - VidFast / Embed iframe: ZERO duplicate controls, direct postMessage remote control!
    //      OK/Enter = Play/Pause, Left/Right = -10s/+10s, Up/Down = Volume, Back = Exit Fullscreen
    if(isFullscreenPlayerActive()){
      if(kc===413){e.preventDefault();e.stopPropagation();exitFullscreenPlayer();return}
      const dirMap={ArrowRight:'right',ArrowLeft:'left',ArrowDown:'down',ArrowUp:'up'};
      const dir=dirMap[e.key];
      const isOk=e.key==='Enter'||kc===13||e.key===' ';

      if(!isNativeVideoActive()){
        const fsBack=$('#fs-back-btn');
        if(activeEl===fsBack&&isOk){
          e.preventDefault();e.stopPropagation();
          exitFullscreenPlayer();
          return;
        }
        // Pressing Down / Left / Right from the Back pill focuses the VidFast iframe for native seek/volume
        if(activeEl===fsBack&&(dir==='down'||dir==='left'||dir==='right')){
          e.preventDefault();e.stopPropagation();
          fsBack.classList.remove('tv-focus');
          const frame=$('#stream-player');
          if(frame){try{frame.focus({preventScroll:true})}catch{}}
          return;
        }
        if(dir==='up'&&fsBack){
          e.preventDefault();e.stopPropagation();
          try{fsBack.focus({preventScroll:true})}catch{}
          fsBack.classList.add('tv-focus');
          return;
        }
        if(isOk||kc===415||kc===19||kc===179||e.key==='MediaPlayPause'){
          e.preventDefault();e.stopPropagation();
          if(kc===19)embedTogglePlayPause(false);
          else if(kc===415)embedTogglePlayPause(true);
          else embedTogglePlayPause();
          return;
        }
        if(dir==='left'||kc===412){e.preventDefault();e.stopPropagation();embedSeekBy(-10);return}
        if(dir==='right'||kc===417){e.preventDefault();e.stopPropagation();embedSeekBy(10);return}
        if(dir==='down'){e.preventDefault();e.stopPropagation();embedAdjustVolume(-0.1);return}
        return;
      }

      if(kc===415||kc===19||kc===179||e.key==='MediaPlayPause'){
        e.preventDefault();e.stopPropagation();nativeTogglePlayPause();return;
      }
      if(kc===412){e.preventDefault();e.stopPropagation();nativeSeekBy(-10);return}
      if(kc===417){e.preventDefault();e.stopPropagation();nativeSeekBy(10);return}

      if(!isNativeHudVisible()){
        if(isOk){e.preventDefault();e.stopPropagation();nativeTogglePlayPause();return}
        if(dir==='left'){e.preventDefault();e.stopPropagation();nativeSeekBy(-10);return}
        if(dir==='right'){e.preventDefault();e.stopPropagation();nativeSeekBy(10);return}
        if(dir==='up'||dir==='down'){e.preventDefault();e.stopPropagation();showNativeHud($('#nhud-play'),4000);return}
        return;
      }

      if(dir){
        e.preventDefault();e.stopPropagation();
        const nhud=$('#native-player-hud');
        const curInHud=activeEl&&nhud?.contains(activeEl)?activeEl:$('#nhud-play');
        const next=findNextSpatialTarget(curInHud,dir);
        showNativeHud(next&&nhud?.contains(next)?next:curInHud,4000);
        return;
      }
      if(isOk){
        e.preventDefault();e.stopPropagation();
        const nhud=$('#native-player-hud');
        const target=activeEl&&nhud?.contains(activeEl)?activeEl:$('#nhud-play');
        target?.click();
        return;
      }
      return;
    }

    // C. Hisense Remote CHANNEL UP / CHANNEL DOWN for smooth vertical scrolling
    const isChUp=kc===427||kc===33||e.key==='ChannelUp'||e.key==='PageUp';
    const isChDown=kc===428||kc===34||e.key==='ChannelDown'||e.key==='PageDown';
    if((isChUp||isChDown)&&!isTyping){
      e.preventDefault();
      e.stopPropagation();
      const step=Math.round(window.innerHeight*0.72);
      scrollPageByY(isChDown?step:-step);
      return;
    }

    // D. Hisense VIDAA Remote Color Shortcuts
    if(!isTyping){
      if(kc===403){e.preventDefault();openSearch();return}
      if(kc===404){e.preventDefault();history.pushState(null,'','#my-list');switchView('saved');return}
      if(kc===405){e.preventDefault();history.pushState(null,'','#films');switchView('movies');return}
      if(kc===406){e.preventDefault();history.pushState(null,'','#series');switchView('tv');return}
    }

    // E. 4-Way Spatial D-Pad Navigation across menus, rows, modals & episodes
    const dirMap={ArrowRight:'right',ArrowLeft:'left',ArrowDown:'down',ArrowUp:'up'};
    const dir=dirMap[e.key];
    if(!dir)return;
    if(tag==='INPUT'&&(dir==='left'||dir==='right'))return;
    if(tag==='SELECT'&&(dir==='up'||dir==='down'))return;

    const current=activeEl&&activeEl!==document.body?activeEl:lastTvFocused;
    const next=findNextSpatialTarget(current,dir);
    if(!next)return;
    e.preventDefault();
    next.focus({preventScroll:true});
    setTvFocusRing(next);
    smoothFocusScroll(next,dir);
  },true);

  // 2. Zero-layout-thrash pointer focus snap (fast on VIDAA & Smart TV GPUs)
  document.addEventListener('pointerover',e=>{
    const direct=e.target?.closest?.(FOCUS_SELECTOR);
    if(direct&&!isExcludedFromTvFocus(direct)&&lastTvFocused!==direct){
      setTvFocusRing(direct);
    }
  },{passive:true});

  document.addEventListener('focusin',e=>{
    const target=e.target?.closest?.(FOCUS_SELECTOR);
    if(target&&!isExcludedFromTvFocus(target))setTvFocusRing(target);
  });
})();
$('#player-adblock-btn')?.addEventListener('click',()=>setAdBlocker(!adBlockerActive));
$('#top-adblock-btn')?.addEventListener('click',()=>setAdBlocker(!adBlockerActive));
$('#adblock-setting-toggle')?.addEventListener('change',e=>setAdBlocker(e.target.checked));
$('#server-select')?.addEventListener('change',e=>{currentStreamServer=STREAM_SERVERS[e.target.value]?e.target.value:'vidfast';localStorage.setItem('moviebox-stream-server-v5',currentStreamServer);if(activeMovie&&activeMovie.source==='TMDB'&&isPlayerActive()){notify(`Switched to ${e.target.selectedOptions[0]?.textContent||STREAM_SERVERS[currentStreamServer]}`);playMovie(activeMovie)}});
$('#player-reload')?.addEventListener('click',()=>{if(activeMovie&&isPlayerActive()){notify('↻ Reloading stream with Ad Shield active…');playMovie(activeMovie)}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();openSearch()}if((e.key==='f'||e.key==='F')&&!e.metaKey&&!e.ctrlKey&&isPlayerActive()&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();toggleFullscreen()}});
applyAdBlockerSandbox();
updateAdBlockUI();
refreshFilterOptions();
render();
handleRoute();
loadTMDBCatalog().then(()=>{if(window.location.hash.startsWith('#title/')&&currentView!=='detail')handleRoute()}).catch(err=>{console.warn('TMDB catalog unavailable',err);notify('TMDB unavailable · Loading free classic films');loadInternetArchive()});
