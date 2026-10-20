/* ちゃわん娘アルバム
 * このファイルの変更は不要です。
 * photos/ の中にフォルダと写真を追加するだけで自動表示します。
 */
(() => {
  'use strict';

  // 以前使っていたGitHub PagesのURLに合わせて設定済み。
  const REPOSITORY_OWNER = 'yosakoi-web';
  const REPOSITORY_NAME = 'yosakoialbum';
  const VIEW_PASSWORD = 'ちゃわん娘';
  const SESSION_KEY = 'chawan_album_unlocked';
  const INITIAL_ALBUMS = ['にっぽんど真ん中祭り', '萩原チンドン祭り', 'MAHA-G'];
  const SUPPORTED_IMAGES = /\.(?:jpe?g|png|webp|gif|avif)$/i;
  const BASE_URL = new URL('.', document.baseURI);
  const API_BASE = `https://api.github.com/repos/${encodeURIComponent(REPOSITORY_OWNER)}/${encodeURIComponent(REPOSITORY_NAME)}/contents`;
  const sorter = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  const albumCache = new Map();
  const palette = [
    ['#b76560', '#de9a7e'],
    ['#697b86', '#9bb0a7'],
    ['#a37d5a', '#d4b685'],
    ['#72866d', '#a8b99a'],
    ['#6e6c8f', '#a3a1bd'],
  ];
  let albumNames = [...INITIAL_ALBUMS];
  let activeAlbum = null;
  let activePhotos = [];
  let viewerIndex = 0;
  let modalAlbum = null;
  let toastTimer = null;
  let busy = false;

  const el = id => document.getElementById(id);
  const show = node => node.classList.remove('hidden');
  const hide = node => node.classList.add('hidden');

  function safeSessionGet() {
    try { return sessionStorage.getItem(SESSION_KEY) === 'yes'; }
    catch (_) { return false; }
  }
  function safeSessionSet(value) {
    try { value ? sessionStorage.setItem(SESSION_KEY, 'yes') : sessionStorage.removeItem(SESSION_KEY); }
    catch (_) { /* ブラウザが記憶を許可しなくても表示できます */ }
  }

  function notify(message) {
    clearTimeout(toastTimer);
    el('toast').textContent = message;
    show(el('toast'));
    toastTimer = setTimeout(() => hide(el('toast')), 4500);
  }
  function setNotice(id, message) {
    const box = el(id);
    if (message) { box.textContent = message; show(box); }
    else { box.textContent = ''; hide(box); }
  }
  function apiPath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }
  async function listDirectory(path) {
    const response = await fetch(`${API_BASE}/${apiPath(path)}`, {
      headers: { 'Accept': 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(response.status === 403 ? 'GitHubのアクセス制限に達しました。しばらくしてから開き直してください。' : `GitHubから一覧を取得できませんでした（${response.status}）。`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }
  function photoLink(albumName, file) {
    // GitHub Pagesではサイト内のファイルを使うので、ダウンロード時も同一オリジンで動きます。
    if (location.protocol === 'file:' && file.download_url) return file.download_url;
    return new URL(`photos/${encodeURIComponent(albumName)}/${encodeURIComponent(file.name)}?v=${String(file.sha || '').slice(0,10)}`, BASE_URL).href;
  }
  function loadPhotos(albumName) {
    if (!albumCache.has(albumName)) {
      const promise = listDirectory(`photos/${albumName}`)
        .then(entries => entries
          .filter(file => file.type === 'file' && SUPPORTED_IMAGES.test(file.name))
          .sort((a,b) => sorter.compare(a.name,b.name))
          .map(file => ({ name:file.name, url:photoLink(albumName,file), size:file.size || 0 })));
      albumCache.set(albumName, promise);
      promise.catch(() => { if (albumCache.get(albumName) === promise) albumCache.delete(albumName); });
    }
    return albumCache.get(albumName);
  }
  function albumColor(name) {
    const index = albumNames.indexOf(name);
    return palette[(index < 0 ? 0 : index) % palette.length];
  }

  async function initializeHome() {
    el('albumGrid').innerHTML = '<div class="loading-state"><span class="spinner"></span>アルバムを読み込んでいます</div>';
    setNotice('homeNotice','');
    try {
      const directories = await listDirectory('photos');
      const names = directories.filter(entry => entry.type === 'dir' && !entry.name.startsWith('.')).map(entry => entry.name);
      const extras = names.filter(name => !INITIAL_ALBUMS.includes(name)).sort(sorter.compare);
      albumNames = [...INITIAL_ALBUMS, ...extras];
    } catch (error) {
      albumNames = [...INITIAL_ALBUMS];
      setNotice('homeNotice', `写真一覧に接続できませんでした。${error.message}`);
    }
    await renderAlbumCards();
    routeFromHash();
  }

  async function renderAlbumCards() {
    const grid = el('albumGrid');
    grid.replaceChildren();
    el('albumCount').textContent = `${albumNames.length} アルバム`;
    const cards = [];
    for (const name of albumNames) {
      const card = document.createElement('article');
      card.className = 'album-card';
      const cover = document.createElement('button');
      cover.className = 'album-cover';
      cover.type = 'button';
      cover.setAttribute('aria-label', `${name}を開く`);
      cover.addEventListener('click', () => openAlbum(name));
      const fall = document.createElement('div');
      fall.className = 'album-fallback';
      const colors = albumColor(name);
      fall.style.background = `linear-gradient(130deg,${colors[0]},${colors[1]})`;
      const symbol = document.createElement('span');
      symbol.textContent = name === 'MAHA-G' ? 'M' : '祭';
      fall.append(symbol);
      const chip = document.createElement('span');
      chip.className = 'album-cover-chip';
      chip.textContent = 'PHOTO ALBUM';
      cover.append(fall,chip);
      const info = document.createElement('div');
      info.className = 'album-info';
      const h3 = document.createElement('h3');
      h3.className = 'album-name';
      h3.textContent = name;
      const sub = document.createElement('p');
      sub.className = 'album-sub';
      sub.textContent = '写真を確認中…';
      const actions = document.createElement('div');
      actions.className = 'album-actions';
      const open = document.createElement('button');
      open.className = 'album-open';
      open.type = 'button';
      open.textContent = 'アルバムを見る →';
      open.addEventListener('click', () => openAlbum(name));
      const save = document.createElement('button');
      save.className = 'album-save';
      save.type = 'button';
      save.textContent = '↓ まとめて保存';
      save.disabled = true;
      save.addEventListener('click', () => openBulk(name));
      actions.append(open,save);
      info.append(h3,sub,actions);
      card.append(cover,info);
      grid.append(card);
      cards.push({ name,cover,fall,chip,sub,save });
    }
    // 最初の写真を表紙として表示。ファイルの追加時にHTMLを更新する必要はありません。
    await Promise.all(cards.map(async card => {
      try {
        const photos = await loadPhotos(card.name);
        card.sub.textContent = photos.length ? `${photos.length} 枚の写真` : '写真はまだありません';
        card.save.disabled = photos.length === 0;
        if (photos.length) {
          const img = document.createElement('img');
          img.src = photos[0].url;
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('load', () => { card.fall.remove(); }, { once: true });
          img.addEventListener('error', () => { img.remove(); }, { once: true });
          card.cover.insertBefore(img,card.chip);
        }
      } catch (_) {
        card.sub.textContent = '一覧を取得できません';
      }
    }));
  }

  function openAlbum(name) {
    const hash = `#album=${encodeURIComponent(name)}`;
    if (location.hash === hash) routeFromHash();
    else location.hash = hash;
  }
  function routeFromHash() {
    if (el('site').classList.contains('hidden')) return;
    const name = new URLSearchParams(location.hash.replace(/^#/, '')).get('album');
    if (name) renderGallery(name);
    else {
      activeAlbum = null;
      activePhotos = [];
      hide(el('albumView'));
      show(el('homeView'));
      document.title = 'ちゃわん娘アルバム';
      window.scrollTo(0,0);
    }
  }
  async function renderGallery(name) {
    const switched = activeAlbum !== name;
    activeAlbum = name;
    show(el('albumView'));
    hide(el('homeView'));
    document.title = `${name}｜ちゃわん娘アルバム`;
    el('galleryTitle').textContent = name;
    el('galleryCount').textContent = '写真を読み込んでいます…';
    el('galleryBulk').disabled = true;
    el('photoGrid').innerHTML = '<div class="loading-state"><span class="spinner"></span>写真を読み込んでいます</div>';
    setNotice('galleryNotice','');
    if (switched) window.scrollTo(0,0);
    try {
      const photos = await loadPhotos(name);
      if (activeAlbum !== name) return;
      activePhotos = photos;
      el('galleryCount').textContent = `${photos.length} 枚の写真`;
      el('galleryBulk').disabled = !photos.length;
      renderPhotos(photos);
    } catch (error) {
      if (activeAlbum !== name) return;
      activePhotos = [];
      el('galleryCount').textContent = '取得できませんでした';
      el('photoGrid').innerHTML = '<div class="empty-state">写真を表示できませんでした。</div>';
      setNotice('galleryNotice',error.message);
    }
  }
  function renderPhotos(photos) {
    const grid = el('photoGrid');
    grid.replaceChildren();
    if (!photos.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>まだ写真がありません</strong><span>写真が追加されると、ここに自動で表示されます。</span>';
      grid.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const [index, photo] of photos.entries()) {
      const card = document.createElement('article');
      card.className = 'photo-card';
      const button = document.createElement('button');
      button.className = 'photo-thumb';
      button.type = 'button';
      button.setAttribute('aria-label', `${photo.name}をプレビュー`);
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.loading = index < 4 ? 'eager' : 'lazy';
      img.decoding = 'async';
      button.append(img);
      button.addEventListener('click', () => openViewer(index));
      const meta = document.createElement('div');
      meta.className = 'photo-meta';
      const title = document.createElement('p');
      title.className = 'photo-name';
      title.title = photo.name;
      title.textContent = photo.name;
      const download = document.createElement('button');
      download.className = 'photo-download';
      download.type = 'button';
      download.setAttribute('aria-label', `${photo.name}をダウンロード`);
      download.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>';
      download.addEventListener('click', () => downloadOne(photo));
      meta.append(title,download);
      card.append(button,meta);
      fragment.append(card);
    }
    grid.append(fragment);
  }

  function openViewer(index) {
    viewerIndex = index;
    updateViewer();
    show(el('viewer'));
    document.body.style.overflow = 'hidden';
    el('viewer').focus();
  }
  function updateViewer() {
    if (!activePhotos.length) return;
    const photo = activePhotos[viewerIndex];
    el('viewerPosition').textContent = `${viewerIndex + 1} / ${activePhotos.length}`;
    el('viewerFilename').textContent = photo.name;
    el('viewerImage').src = photo.url;
    el('viewerImage').alt = photo.name;
    el('viewerPrev').disabled = viewerIndex <= 0;
    el('viewerNext').disabled = viewerIndex >= activePhotos.length - 1;
  }
  function stepViewer(amount) {
    const next = viewerIndex + amount;
    if (next >= 0 && next < activePhotos.length) { viewerIndex = next; updateViewer(); }
  }
  function closeViewer() {
    hide(el('viewer'));
    document.body.style.overflow = '';
    el('viewerImage').removeAttribute('src');
  }

  async function fetchPhotoBytes(photo) {
    const response = await fetch(photo.url);
    if (!response.ok) throw new Error(`「${photo.name}」を取得できませんでした。`);
    return response.arrayBuffer();
  }
  function browserSave(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function downloadOne(photo) {
    try {
      notify('写真をダウンロードしています…');
      const data = await fetchPhotoBytes(photo);
      browserSave(new Blob([data],{ type: mimeFor(photo.name) }),photo.name);
      notify('ダウンロードを開始しました。');
    } catch (error) { notify(`保存できませんでした：${error.message}`); }
  }
  function mimeFor(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'})[ext] || 'application/octet-stream';
  }

  async function openBulk(name) {
    if (busy) return;
    try {
      const photos = await loadPhotos(name);
      if (!photos.length) { notify('まだ写真がありません。'); return; }
      modalAlbum = name;
      el('bulkDescription').textContent = `「${name}」の写真 ${photos.length} 枚を保存します。`;
      show(el('bulkModal'));
      document.body.style.overflow = 'hidden';
    } catch (error) { notify(error.message); }
  }
  function closeBulk() {
    hide(el('bulkModal'));
    document.body.style.overflow = '';
  }
  function startProgress(title) {
    busy = true;
    el('progressTitle').textContent = title;
    progress(0,1,'保存の準備中…');
    show(el('progressModal'));
  }
  function progress(n,total,message) {
    el('progressText').textContent = message;
    el('progressBar').style.width = `${Math.round(n / total * 100)}%`;
  }
  function stopProgress() { busy = false; hide(el('progressModal')); }
  async function runBulk(method) {
    if (busy || !modalAlbum) return;
    const name = modalAlbum;
    closeBulk();
    const photos = await loadPhotos(name);
    startProgress(method === 'zip' ? 'ZIPを作成しています' : '写真を個別に保存しています');
    try {
      if (method === 'zip') {
        const zipBlob = await createZip(photos, (n,total) => progress(n,total,`${n} / ${total} 枚を準備中`));
        browserSave(zipBlob,`${name}_写真${photos.length}枚.zip`);
        notify('ZIPのダウンロードを開始しました。');
      } else {
        for (let i=0; i<photos.length; i++) {
          progress(i,photos.length,`${i + 1} / ${photos.length} 枚を保存中`);
          const bytes = await fetchPhotoBytes(photos[i]);
          browserSave(new Blob([bytes],{type:mimeFor(photos[i].name)}), photos[i].name);
          // ブラウザに連続保存の許可を求められる場合があります。
          await new Promise(resolve => setTimeout(resolve,260));
        }
        progress(photos.length,photos.length,`${photos.length} 枚の保存処理を完了`);
        notify('写真の保存処理が終わりました。保存されない場合はZIPを選んでください。');
      }
    } catch (error) {
      notify(`保存できませんでした：${error.message}`);
    } finally { stopProgress(); }
  }

  // 写真はすでに圧縮されているため、ZIPは無圧縮で1つにまとめます。
  // 外部ライブラリや外部CDN不要。日本語ファイル名にも対応します。
  const crcTable = new Uint32Array(256);
  for (let i=0; i<256; i++) {
    let c=i;
    for (let j=0; j<8; j++) c=(c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i]=c>>>0;
  }
  function crc32(bytes) {
    let c=0xFFFFFFFF;
    for (let i=0; i<bytes.length; i++) c=crcTable[(c^bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c^0xFFFFFFFF)>>>0;
  }
  function zipDate() {
    const now=new Date();
    const date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    const time=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2);
    return {date,time};
  }
  async function createZip(photos,onProgress) {
    if (photos.length > 65535) throw new Error('写真が多すぎるため、分けて保存してください。');
    const encoder = new TextEncoder();
    const {date,time} = zipDate();
    const localParts=[];
    const centralParts=[];
    let offset=0;
    let centralSize=0;
    let totalEstimate=0;
    for (let index=0;index<photos.length;index++) {
      const photo=photos[index];
      const buffer=await fetchPhotoBytes(photo);
      const bytes=new Uint8Array(buffer);
      const filename=encoder.encode(photo.name);
      const size=bytes.byteLength;
      totalEstimate += size;
      if (size > 0xFFFFFFFF || offset+size > 0xFFFFFFFF || totalEstimate > 1500000000) {
        throw new Error('ZIPが大きすぎます。写真を個別に保存してください。');
      }
      const crc=crc32(bytes);
      const local=new Uint8Array(30+filename.length);
      const l=new DataView(local.buffer);
      l.setUint32(0,0x04034B50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);
      l.setUint16(8,0,true);l.setUint16(10,time,true);l.setUint16(12,date,true);
      l.setUint32(14,crc,true);l.setUint32(18,size,true);l.setUint32(22,size,true);
      l.setUint16(26,filename.length,true);l.setUint16(28,0,true);
      local.set(filename,30);
      const central=new Uint8Array(46+filename.length);
      const c=new DataView(central.buffer);
      c.setUint32(0,0x02014B50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);
      c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,time,true);c.setUint16(14,date,true);
      c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);
      c.setUint16(28,filename.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);
      c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);
      c.setUint32(42,offset,true);
      central.set(filename,46);
      localParts.push(local,buffer);
      centralParts.push(central);
      offset += local.byteLength + size;
      centralSize += central.byteLength;
      onProgress(index+1,photos.length);
      // UIが固まらないように描画時間を渡します。
      await new Promise(resolve => setTimeout(resolve,0));
    }
    const end=new Uint8Array(22);
    const e=new DataView(end.buffer);
    e.setUint32(0,0x06054B50,true);
    e.setUint16(8,photos.length,true);e.setUint16(10,photos.length,true);
    e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  }

  function unlock() {
    safeSessionSet(true);
    hide(el('login'));
    show(el('site'));
    initializeHome();
  }
  function lock() {
    safeSessionSet(false);
    closeViewer();
    closeBulk();
    hide(el('site'));
    show(el('login'));
    el('password').value='';
    el('loginError').textContent='';
    el('password').focus();
  }
  el('loginForm').addEventListener('submit', event => {
    event.preventDefault();
    if (el('password').value.normalize('NFC') === VIEW_PASSWORD.normalize('NFC')) unlock();
    else { el('loginError').textContent = '合言葉が違うみたいです。もう一度入力してね。'; el('password').select(); }
  });
  el('togglePassword').addEventListener('click', () => {
    const input=el('password');
    const hidden=input.type==='password';
    input.type=hidden?'text':'password';
    el('togglePassword').textContent=hidden?'隠す':'表示';
    input.focus();
  });
  el('password').addEventListener('input',()=>el('loginError').textContent='');
  el('lockButton').addEventListener('click',lock);
  el('backButton').addEventListener('click',() => { location.hash=''; routeFromHash(); });
  el('galleryBulk').addEventListener('click',() => openBulk(activeAlbum));
  el('viewerClose').addEventListener('click',closeViewer);
  el('viewerPrev').addEventListener('click',()=>stepViewer(-1));
  el('viewerNext').addEventListener('click',()=>stepViewer(1));
  el('viewerDownload').addEventListener('click',()=>downloadOne(activePhotos[viewerIndex]));
  el('bulkClose').addEventListener('click',closeBulk);
  el('bulkModal').addEventListener('click',event => { if (event.target===el('bulkModal')) closeBulk(); });
  el('bulkIndividual').addEventListener('click',()=>runBulk('individual'));
  el('bulkZip').addEventListener('click',()=>runBulk('zip'));
  window.addEventListener('hashchange',routeFromHash);
  window.addEventListener('keydown',event => {
    if (!el('viewer').classList.contains('hidden')) {
      if (event.key==='Escape') closeViewer();
      if (event.key==='ArrowLeft') stepViewer(-1);
      if (event.key==='ArrowRight') stepViewer(1);
    } else if (event.key==='Escape' && !el('bulkModal').classList.contains('hidden')) closeBulk();
  });
  let touchStart=null;
  el('viewerStage').addEventListener('touchstart',event => {
    if (event.touches.length===1) touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  el('viewerStage').addEventListener('touchend',event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx=event.changedTouches[0].clientX-touchStart.x;
    const dy=event.changedTouches[0].clientY-touchStart.y;
    if (Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.3) stepViewer(dx<0?1:-1);
    touchStart=null;
  },{passive:true});

  if (safeSessionGet()) unlock();
  else el('password').focus();
})();
