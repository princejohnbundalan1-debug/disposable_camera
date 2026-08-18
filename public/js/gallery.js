/**
 * Gallery & Lightbox Controller
 */

class GalleryViewer {
  constructor() {
    this.mediaItems = [];
    this.currentIndex = 0;
    this.currentFilter = 'all';

    this.lightbox = document.getElementById('lightboxModal');
    this.lightboxMedia = document.getElementById('lightboxMediaContainer');
    this.lightboxAuthor = document.getElementById('lightboxAuthor');
    this.lightboxCaption = document.getElementById('lightboxCaption');
    this.lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
    this.closeBtn = document.getElementById('closeLightboxBtn');
    this.prevBtn = document.getElementById('prevLightboxBtn');
    this.nextBtn = document.getElementById('nextLightboxBtn');

    this.init();
  }

  init() {
    this.extractMediaData();
    this.initFilterButtons();
    this.initLightboxEvents();
  }

  extractMediaData() {
    const cards = document.querySelectorAll('.gallery-item');
    this.mediaItems = Array.from(cards).map((card, idx) => ({
      index: idx,
      id: card.dataset.id,
      type: card.dataset.type,
      url: card.dataset.url,
      uploader: card.dataset.uploader,
      caption: card.dataset.caption,
      element: card
    }));

    cards.forEach((card, idx) => {
      card.addEventListener('click', () => this.openLightbox(idx));
    });
  }

  initFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentFilter = btn.dataset.filter || 'all';
        this.applyFilter();
      });
    });
  }

  applyFilter() {
    this.mediaItems.forEach(item => {
      if (this.currentFilter === 'all' || item.type === this.currentFilter) {
        item.element.style.display = 'block';
      } else {
        item.element.style.display = 'none';
      }
    });
  }

  initLightboxEvents() {
    if (!this.lightbox) return;

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeLightbox());
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.navigate(-1));
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.navigate(1));

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      if (!this.lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigate(-1);
      if (e.key === 'ArrowRight') this.navigate(1);
    });

    // Touch swipe gestures
    let touchStartX = 0;
    this.lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.lightbox.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) this.navigate(1); // Swipe left -> Next
      if (touchEndX - touchStartX > 50) this.navigate(-1); // Swipe right -> Prev
    }, { passive: true });
  }

  openLightbox(index) {
    this.currentIndex = index;
    this.renderCurrentMedia();
    this.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    if (this.lightbox) this.lightbox.classList.remove('active');
    document.body.style.overflow = '';
    if (this.lightboxMedia) this.lightboxMedia.innerHTML = '';
  }

  navigate(direction) {
    let nextIndex = this.currentIndex + direction;
    if (nextIndex < 0) nextIndex = this.mediaItems.length - 1;
    if (nextIndex >= this.mediaItems.length) nextIndex = 0;
    this.currentIndex = nextIndex;
    this.renderCurrentMedia();
  }

  renderCurrentMedia() {
    const item = this.mediaItems[this.currentIndex];
    if (!item) return;

    this.lightboxMedia.innerHTML = '';

    if (item.type === 'photo') {
      const img = document.createElement('img');
      img.src = item.url;
      img.className = 'lightbox-image';
      img.alt = item.caption || 'Wedding Photo';
      this.lightboxMedia.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = item.url;
      video.className = 'lightbox-video';
      video.controls = true;
      video.autoplay = true;
      this.lightboxMedia.appendChild(video);
    }

    if (this.lightboxAuthor) this.lightboxAuthor.textContent = `Captured by ${item.uploader || 'Guest'}`;
    if (this.lightboxCaption) this.lightboxCaption.textContent = item.caption || '';
    if (this.lightboxDownloadBtn) {
      this.lightboxDownloadBtn.href = `/e/download/${item.id}`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.galleryViewer = new GalleryViewer();
});
