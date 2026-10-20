'use strict';

const nodes = {
  home: document.getElementById('home-screen'),
  album: document.getElementById('album-screen'),
  loading: document.getElementById('loading-state'),
  error: document.getElementById('error-state'),
  heroSubtitle: document.getElementById('hero-subtitle'),
  albumTotal: document.getElementById('album-total'),
  albumGrid: document.getElementById('album-grid'),
  albumTitle: document.getElementById('album-title'),
  albumDescription: document.getElementById('album-description'),
  albumBulkButton: document.getElementById('album-bulk-button'),
  photoCount: document.getElementById('photo-count'),
  photoGrid: document.getElementById('photo-grid'),
  albumEmpty: document.getElementById('album-empty'),
  viewer: document.getElementById('viewer'),
  viewerClose: document.getElementById('viewer-close'),
  viewerImage: document.getElementById('viewer-image'),
  viewerBody: document.getElementById('viewer-body'),
  viewerCount: document.getElementById('viewer-count'),
  viewerDownload: document.getElementById('viewer-download'),
  viewerFilename: document.getElementById('viewer-filename'),
  viewerPrev: document.getElementById('viewer-prev'),
  viewerNext: document.getElementById('viewer-next'),
  bulkDialog: document.getElementById('bulk-dialog'),
  bulkTitle: document.getElementById('bulk-title'),
  bulkExplanation: document.getElementById('bulk-explanation'),
  bulkStatus: document.getElementById('bulk-status'),
  bulkClose: document.getElementById('bulk-close'),
  bulkIndividuals: document.getElementById('download-individuals'),
  bulkZip: document.getElementById('download-zip'),
};

const state = { catalog: null, album: null, photoIndex: -1, bulkAlbum: null, priorFocus: null };
const assetUrl = (relativePath) => new URL(relativePath, document.baseURI).href;
const countText = (number) => `${number}枚`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCover(album, index) {
  const button = element('button', 'album-cover');
  button.type = 'button';
  button.setAttribute('aria-label', `${album.title}のアルバムを開く`);
  button.addEventListener('click', () => { location.hash = `#/album/${album.id}`; });

  if (album.cover) {
    const img = document.createElement('img');
    img.src = assetUrl(album.cover);
    img.alt = `${album.title}の表紙`;
    img.loading = 'lazy';
    button.append(img);
  } else {
    const placeholder = element('span', `cover-placeholder ${['peach','mint','lavender'].includes(album.theme) ? album.theme : 'peach'}`);
    placeholder.append(element('strong', '', '✿'));
    placeholder.append(element('small', '', 'PHOTO ALBUM'));
    button.append(placeholder);
  }
  button.append(element('span', 'album-index', String(index + 1).padStart(2, '0')));
  return button;
}

function renderHome() {
  nodes.albumGrid.replaceChildren();
  nodes.heroSubtitle.textContent = state.catalog.subtitle;
  const allPhotos = state.catalog.albums.reduce((sum, album) => sum + album.count, 0);
  nodes.albumTotal.textContent = `${state.catalog.albums.length} ALBUMS · ${countText(allPhotos)}`;

  for (const [index, album] of state.catalog.albums.entries()) {
    const card = element('article', 'album-card');
    card.append(createCover(album, index));
    const meta = element('div', 'album-meta');
    const details = element('div');
    const title = element('h3');
    const link = element('a', '', album.title);
    link.href = `#/album/${album.id}`;
    title.append(link);
    details.append(title, element('p', '', album.description));
    meta.append(details, element('span', 'album-count', countText(album.count)));
    card.append(meta);
    const download = element('button', 'card-download', '↓ まとめてダウンロード');
    download.type = 'button';
    download.disabled = album.count === 0;
    download.addEventListener('click', () => openBulk(album));
    card.append(download);
    nodes.albumGrid.append(card);
  }
  nodes.home.hidden = false;
  nodes.album.hidden = true;
  document.title = state.catalog.title;
}

function renderAlbum(album) {
  state.album = album;
  nodes.albumTitle.textContent = album.title;
  nodes.albumDescription.textContent = album.description;
  nodes.photoCount.textContent = `全 ${countText(album.count)}`;
  nodes.albumBulkButton.disabled = album.count === 0;
  nodes.albumBulkButton.onclick = () => openBulk(album);
  nodes.photoGrid.replaceChildren();
  nodes.albumEmpty.hidden = album.count > 0;

  for (const [index, photo] of album.photos.entries()) {
    const tile = element('button', 'photo-tile');
    tile.type = 'button';
    tile.setAttribute('aria-label', `${index + 1}枚目 ${photo.name} を拡大`);
    const image = document.createElement('img');
    image.src = assetUrl(photo.thumb);
    image.alt = photo.name;
    image.loading = 'lazy';
    tile.append(image);
    tile.addEventListener('click', () => openViewer(album, index));
    nodes.photoGrid.append(tile);
  }
  nodes.home.hidden = true;
  nodes.album.hidden = false;
  document.title = `${album.title} | ${state.catalog.title}`;
}

function route() {
  if (!state.catalog) return;
  closeViewer();
  if (nodes.bulkDialog.open) nodes.bulkDialog.close();
  const match = location.hash.match(/^#\/album\/([a-z0-9-]+)$/);
  const album = match && state.catalog.albums.find((entry) => entry.id === match[1]);
  if (album) renderAlbum(album);
  else { state.album = null; renderHome(); }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showPhoto() {
  const photo = state.album?.photos[state.photoIndex];
  if (!photo) return;
  nodes.viewerImage.src = assetUrl(photo.full);
  nodes.viewerImage.alt = `${state.album.title}の写真 ${state.photoIndex + 1}`;
  nodes.viewerCount.textContent = `${state.photoIndex + 1} / ${state.album.photos.length}`;
  nodes.viewerFilename.textContent = photo.name;
  nodes.viewerDownload.href = assetUrl(photo.full);
  nodes.viewerDownload.download = photo.name;
  const one = state.album.photos.length === 1;
  nodes.viewerPrev.hidden = one;
  nodes.viewerNext.hidden = one;
}

function openViewer(album, index) {
  state.priorFocus = document.activeElement;
  state.album = album;
  state.photoIndex = index;
  showPhoto();
  nodes.viewer.hidden = false;
  document.body.classList.add('no-scroll');
  nodes.viewerClose.focus();
}

function closeViewer() {
  if (nodes.viewer.hidden) return;
  nodes.viewer.hidden = true;
  nodes.viewerImage.removeAttribute('src');
  state.photoIndex = -1;
  document.body.classList.remove('no-scroll');
  state.priorFocus?.focus?.();
}

function stepPhoto(direction) {
  if (nodes.viewer.hidden || !state.album?.photos.length) return;
  state.photoIndex = (state.photoIndex + direction + state.album.photos.length) % state.album.photos.length;
  showPhoto();
}

function openBulk(album) {
  if (!album.count) return;
  state.bulkAlbum = album;
  nodes.bulkTitle.textContent = `${album.title} を保存`;
  nodes.bulkExplanation.textContent = `${album.count}枚の写真をまとめてダウンロードできます。写真は元の画質のまま保存されます。`;
  nodes.bulkZip.href = album.zip ? assetUrl(album.zip) : '#';
  nodes.bulkZip.download = `${album.title}.zip`;
  nodes.bulkStatus.textContent = 'iPhoneの場合、ダウンロードしたZIPは「ファイル」アプリから開けます。';
  nodes.bulkDialog.showModal();
}

function startIndividualDownloads() {
  const album = state.bulkAlbum;
  if (!album || !album.count) return;
  nodes.bulkStatus.textContent = '個別保存を開始しました。許可の確認が出た場合は承認してください。保存されない場合はZIPをご利用ください。';
  // Mobile Safari and some browsers may block automatic multiple downloads.
  // Each download uses the same-origin original file (not a compressed image).
  album.photos.forEach((photo, index) => {
    window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = assetUrl(photo.full);
      link.download = photo.name;
      link.style.display = 'none';
      document.body.append(link);
      link.click();
      link.remove();
    }, index * 220);
  });
}

let touchStartX = null;
nodes.viewerBody.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0]?.screenX ?? null;
}, { passive: true });
nodes.viewerBody.addEventListener('touchend', (event) => {
  if (touchStartX === null) return;
  const dx = (event.changedTouches[0]?.screenX ?? touchStartX) - touchStartX;
  if (Math.abs(dx) > 55) stepPhoto(dx < 0 ? 1 : -1);
  touchStartX = null;
}, { passive: true });
nodes.viewerClose.addEventListener('click', closeViewer);
nodes.viewerPrev.addEventListener('click', () => stepPhoto(-1));
nodes.viewerNext.addEventListener('click', () => stepPhoto(1));
nodes.viewer.addEventListener('click', (event) => {
  if (event.target === nodes.viewer) closeViewer();
});
nodes.bulkClose.addEventListener('click', () => nodes.bulkDialog.close());
nodes.bulkDialog.addEventListener('click', (event) => { if (event.target === nodes.bulkDialog) nodes.bulkDialog.close(); });
nodes.bulkIndividuals.addEventListener('click', startIndividualDownloads);
nodes.bulkZip.addEventListener('click', () => { nodes.bulkDialog.close(); });
document.addEventListener('keydown', (event) => {
  if (nodes.viewer.hidden) return;
  if (event.key === 'Escape') closeViewer();
  if (event.key === 'ArrowLeft') stepPhoto(-1);
  if (event.key === 'ArrowRight') stepPhoto(1);
});
window.addEventListener('hashchange', route);

fetch(assetUrl('album-data.json'), { cache: 'no-cache' })
  .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then((catalog) => {
    state.catalog = catalog;
    nodes.loading.hidden = true;
    route();
  })
  .catch((error) => {
    console.error('Unable to load gallery:', error);
    nodes.loading.hidden = true;
    nodes.error.hidden = false;
  });
