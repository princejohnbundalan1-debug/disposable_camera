/**
 * Digital Disposable Camera Engine
 * Handles getUserMedia stream, video recording, shutter effects, front/rear camera switch,
 * and graceful fallback to native camera input.
 */

class DisposableCamera {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.facingMode = 'environment'; // default to rear camera for events
    this.currentMode = 'photo'; // 'photo' or 'video'
    this.flashEnabled = false;
    this.capturedBlob = null;
    this.recordTimer = null;
    this.recordSeconds = 0;

    // DOM Elements
    this.modal = document.getElementById('cameraModal');
    this.videoElem = document.getElementById('cameraVideo');
    this.shutterBtn = document.getElementById('shutterBtn');
    this.closeBtn = document.getElementById('closeCameraBtn');
    this.switchCamBtn = document.getElementById('switchCamBtn');
    this.flashBtn = document.getElementById('flashBtn');
    this.modeToggleBtn = document.getElementById('modeToggleBtn');
    this.lcdCounter = document.getElementById('lcdCounterDigits');
    this.flashOverlay = document.getElementById('flashOverlay');
    this.previewOverlay = document.getElementById('capturePreviewOverlay');
    this.previewContainer = document.getElementById('previewMediaContainer');
    this.retakeBtn = document.getElementById('retakeBtn');
    this.confirmUploadBtn = document.getElementById('confirmUploadBtn');
    this.fallbackInput = document.getElementById('fallbackCameraInput');

    this.initEventListeners();
  }

  initEventListeners() {
    if (!this.modal) return;

    // Trigger buttons
    document.querySelectorAll('[data-open-camera]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = btn.dataset.openCamera || 'photo';
        this.open(mode);
      });
    });

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.switchCamBtn) this.switchCamBtn.addEventListener('click', () => this.toggleFacingMode());
    if (this.flashBtn) this.flashBtn.addEventListener('click', () => this.toggleFlash());
    if (this.modeToggleBtn) this.modeToggleBtn.addEventListener('click', () => this.toggleMode());
    if (this.shutterBtn) this.shutterBtn.addEventListener('click', () => this.handleShutter());
    if (this.retakeBtn) this.retakeBtn.addEventListener('click', () => this.retake());
    if (this.confirmUploadBtn) this.confirmUploadBtn.addEventListener('click', () => this.uploadCaptured());

    // Native file input fallback change handler
    if (this.fallbackInput) {
      this.fallbackInput.addEventListener('change', (e) => this.handleFallbackFile(e));
    }
  }

  async open(mode = 'photo') {
    this.currentMode = mode;
    this.updateModeUI();
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    await this.startCamera();
  }

  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[Camera] getUserMedia not supported, falling back to native file input');
      this.triggerNativeFallback();
      return;
    }

    this.stopCameraStream();

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: this.currentMode === 'video'
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElem.srcObject = this.stream;
      await this.videoElem.play();
    } catch (err) {
      console.warn('[Camera] Stream error or permission denied:', err.message);
      this.close();
      this.triggerNativeFallback();
    }
  }

  stopCameraStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElem) {
      this.videoElem.srcObject = null;
    }
  }

  close() {
    this.stopCameraStream();
    if (this.modal) this.modal.classList.remove('active');
    if (this.previewOverlay) this.previewOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleFacingMode() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.startCamera();
  }

  toggleFlash() {
    this.flashEnabled = !this.flashEnabled;
    if (this.flashBtn) {
      this.flashBtn.classList.toggle('active', this.flashEnabled);
    }
  }

  toggleMode() {
    this.currentMode = this.currentMode === 'photo' ? 'video' : 'photo';
    this.updateModeUI();
    this.startCamera();
  }

  updateModeUI() {
    if (this.shutterBtn) {
      this.shutterBtn.classList.toggle('video-mode', this.currentMode === 'video');
    }
    if (this.modeToggleBtn) {
      this.modeToggleBtn.innerHTML = this.currentMode === 'photo' ? '🎥' : '📷';
      this.modeToggleBtn.title = `Switch to ${this.currentMode === 'photo' ? 'Video' : 'Photo'} Mode`;
    }
  }

  handleShutter() {
    if (this.currentMode === 'photo') {
      this.capturePhoto();
    } else {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    }
  }

  // 1. Photo Capture with Strobe Flash and Canvas Snapshot
  capturePhoto() {
    // Flash strobe effect
    if (this.flashOverlay) {
      this.flashOverlay.classList.add('flash-active');
      setTimeout(() => this.flashOverlay.classList.remove('flash-active'), 350);
    }

    // Audio click effect
    this.playShutterAudio();

    // Create canvas snapshot
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElem.videoWidth || 1280;
    canvas.height = this.videoElem.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    // Flip horizontally if front camera
    if (this.facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(this.videoElem, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      this.capturedBlob = blob;
      this.showPreview('photo', URL.createObjectURL(blob));
    }, 'image/jpeg', 0.92);
  }

  // 2. Video Recording using MediaRecorder API
  startRecording() {
    this.recordedChunks = [];
    this.isRecording = true;
    this.shutterBtn.classList.add('recording');

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';
      
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.capturedBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.showPreview('video', URL.createObjectURL(this.capturedBlob));
      };

      this.mediaRecorder.start(200);

      // Start recording timer on LCD
      this.recordSeconds = 0;
      this.recordTimer = setInterval(() => {
        this.recordSeconds++;
        const mins = String(Math.floor(this.recordSeconds / 60)).padStart(2, '0');
        const secs = String(this.recordSeconds % 60).padStart(2, '0');
        if (this.lcdCounter) {
          this.lcdCounter.textContent = `REC ${mins}:${secs}`;
          this.lcdCounter.style.color = '#FF5252';
        }
      }, 1000);
    } catch (err) {
      console.error('[Camera] MediaRecorder error:', err);
      alert('Video recording is not supported in this browser mode.');
    }
  }

  stopRecording() {
    this.isRecording = false;
    this.shutterBtn.classList.remove('recording');
    clearInterval(this.recordTimer);
    if (this.lcdCounter) {
      this.lcdCounter.textContent = 'READY';
      this.lcdCounter.style.color = '#4EFA87';
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  showPreview(type, objectUrl) {
    this.stopCameraStream();
    this.previewContainer.innerHTML = '';

    if (type === 'photo') {
      const img = document.createElement('img');
      img.src = objectUrl;
      this.previewContainer.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = objectUrl;
      video.controls = true;
      video.autoplay = true;
      this.previewContainer.appendChild(video);
    }

    this.previewOverlay.classList.add('active');
  }

  retake() {
    this.capturedBlob = null;
    this.previewOverlay.classList.remove('active');
    this.startCamera();
  }

  async uploadCaptured() {
    if (!this.capturedBlob) return;

    const publicId = window.EVENT_PUBLIC_ID;
    if (!publicId) {
      alert('Event ID missing');
      return;
    }

    const guestNameInput = document.getElementById('previewGuestName');
    const captionInput = document.getElementById('previewCaption');
    const guestName = guestNameInput ? guestNameInput.value.trim() : 'Guest';
    const caption = captionInput ? captionInput.value.trim() : '';

    this.confirmUploadBtn.disabled = true;
    this.confirmUploadBtn.textContent = 'Adding to Album... ⏳';

    const formData = new FormData();
    const ext = this.currentMode === 'photo' ? 'jpg' : 'webm';
    const filename = `camera_${Date.now()}.${ext}`;
    
    formData.append('media', this.capturedBlob, filename);
    formData.append('guest_name', guestName);
    formData.append('caption', caption);

    try {
      const res = await fetch(`/e/${publicId}/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        this.close();
        // Toast notification and refresh or redirect
        if (window.showToast) {
          window.showToast('Photo added to the wedding roll! 📸');
        }
        setTimeout(() => {
          window.location.href = `/e/${publicId}/album`;
        }, 800);
      } else {
        alert(data.message || 'Upload failed');
        this.confirmUploadBtn.disabled = false;
        this.confirmUploadBtn.textContent = 'Add to Album 💍';
      }
    } catch (err) {
      console.error('[Camera] Upload error:', err);
      alert('Network error. Please try uploading again.');
      this.confirmUploadBtn.disabled = false;
      this.confirmUploadBtn.textContent = 'Add to Album 💍';
    }
  }

  triggerNativeFallback() {
    if (this.fallbackInput) {
      this.fallbackInput.click();
    }
  }

  handleFallbackFile(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Delegate to Uploader module
      if (window.eventUploader) {
        window.eventUploader.handleFiles(files);
      }
    }
  }

  playShutterAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.disposableCamera = new DisposableCamera();
});
