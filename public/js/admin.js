/**
 * Admin & Organizer Interactive Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Copy to Clipboard buttons
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2000);
      } catch (err) {
        prompt('Copy this link:', textToCopy);
      }
    });
  });

  // Upload killswitch AJAX toggle
  const uploadToggleCheckbox = document.getElementById('toggleUploadsCheckbox');
  if (uploadToggleCheckbox) {
    uploadToggleCheckbox.addEventListener('change', async () => {
      const publicId = uploadToggleCheckbox.dataset.publicId;
      try {
        const res = await fetch(`/admin/events/${publicId}/toggle-uploads`, {
          method: 'POST',
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          const statusText = document.getElementById('uploadStatusLabel');
          if (statusText) {
            statusText.textContent = data.is_uploads_enabled ? 'Uploads are currently OPEN' : 'Uploads are CLOSED';
          }
        }
      } catch (err) {
        console.error('[Admin] Toggle uploads error:', err);
      }
    });
  }
});
