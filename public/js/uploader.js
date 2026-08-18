/**
 * Gallery & Media Uploader Engine
 * Drag-and-drop, multi-file selection, live progress tracking, and validation.
 */

class EventUploader {
  constructor() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('galleryFileInput');
    this.uploadModal = document.getElementById('uploadModal');
    this.uploadProgressModal = document.getElementById('uploadProgressModal');
    this.progressBar = document.getElementById('uploadProgressBar');
    this.progressText = document.getElementById('uploadProgressText');
    this.selectedFiles = [];

    this.initEventListeners();
  }

  initEventListeners() {
    // Open upload modal buttons
    document.querySelectorAll('[data-open-uploader]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openFileSelector();
      });
    });

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
    }

    // Drag and drop handlers
    if (this.dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropZone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropZone.classList.remove('drag-over');
        });
      });

      this.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFiles(files);
      });
    }

    // Form submit
    const uploadForm = document.getElementById('directUploadForm');
    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitUpload();
      });
    }
  }

  openFileSelector() {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    this.selectedFiles = Array.from(fileList);

    // Render preview chips
    const previewList = document.getElementById('uploadPreviewList');
    if (previewList) {
      previewList.innerHTML = '';
      this.selectedFiles.forEach((file, index) => {
        const chip = document.createElement('div');
        chip.className = 'file-preview-chip';
        const isImg = file.type.startsWith('image/');
        chip.innerHTML = `
          <div class="chip-icon">${isImg ? '🖼' : '🎥'}</div>
          <div class="chip-name">${file.name}</div>
          <div class="chip-size">${(file.size / (1024 * 1024)).toFixed(1)} MB</div>
        `;
        previewList.appendChild(chip);
      });
    }

    // Open upload details modal if present
    if (this.uploadModal) {
      this.uploadModal.classList.add('active');
    } else {
      // Direct submit
      this.submitUpload();
    }
  }

  submitUpload() {
    if (this.selectedFiles.length === 0) return;

    const publicId = window.EVENT_PUBLIC_ID;
    if (!publicId) {
      alert('Event ID is missing');
      return;
    }

    const guestNameInput = document.getElementById('uploaderGuestName');
    const captionInput = document.getElementById('uploaderCaption');
    const guestName = guestNameInput ? guestNameInput.value.trim() : 'Guest';
    const caption = captionInput ? captionInput.value.trim() : '';

    const formData = new FormData();
    this.selectedFiles.forEach(file => {
      formData.append('media', file);
    });
    formData.append('guest_name', guestName);
    formData.append('caption', caption);

    // Show Progress Bar UI
    if (this.uploadModal) this.uploadModal.classList.remove('active');
    this.showProgressUI();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/e/${publicId}/upload`, true);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        this.updateProgress(percent, `Uploading moments... ${percent}%`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          this.updateProgress(100, '✨ Upload complete! Adding to album...');
          setTimeout(() => {
            this.hideProgressUI();
            if (window.showToast) {
              window.showToast(res.message || 'Photos added to album!');
            }
            window.location.href = `/e/${publicId}/album`;
          }, 800);
        } catch (e) {
          window.location.href = `/e/${publicId}/album`;
        }
      } else {
        let errMessage = 'Upload failed. Please try again.';
        try {
          const res = JSON.parse(xhr.responseText);
          errMessage = res.message || errMessage;
        } catch (e) {}
        alert(errMessage);
        this.hideProgressUI();
      }
    };

    xhr.onerror = () => {
      alert('Network connection error during upload.');
      this.hideProgressUI();
    };

    xhr.send(formData);
  }

  showProgressUI() {
    if (this.uploadProgressModal) {
      this.uploadProgressModal.classList.add('active');
      this.updateProgress(5, 'Preparing files...');
    }
  }

  hideProgressUI() {
    if (this.uploadProgressModal) {
      this.uploadProgressModal.classList.remove('active');
    }
  }

  updateProgress(percent, message) {
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
    if (this.progressText) {
      this.progressText.textContent = message;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.eventUploader = new EventUploader();
});
