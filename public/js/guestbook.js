/**
 * Wedding Guestbook & Wishes Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('guestbookForm');
  const messagesGrid = document.getElementById('messagesGrid');
  const submitBtn = document.getElementById('submitWishBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const publicId = window.EVENT_PUBLIC_ID;
    if (!publicId) return;

    const nameInput = document.getElementById('guestNameInput');
    const messageInput = document.getElementById('guestMessageInput');
    const guestName = nameInput ? nameInput.value.trim() : 'Anonymous Guest';
    const message = messageInput ? messageInput.value.trim() : '';

    if (!message) {
      alert('Please write your wish or message.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Wish... 💌';
    }

    try {
      const res = await fetch(`/e/${publicId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          guest_name: guestName,
          message: message
        })
      });

      const data = await res.json();
      if (data.success) {
        // Prepend optimistic message card
        if (messagesGrid) {
          const card = document.createElement('div');
          card.className = 'message-card';
          card.style.animation = 'fadeIn 0.4s ease';
          card.innerHTML = `
            <div class="message-text">"${data.data.message}"</div>
            <div class="message-author">💌 ${data.data.guest_name}</div>
            <div class="message-date">Just now</div>
          `;
          messagesGrid.prepend(card);
        }

        // Reset form
        form.reset();
        if (window.showToast) {
          window.showToast('Your wedding wish has been delivered to the couple! 💍');
        }
      } else {
        alert(data.message || 'Could not post message.');
      }
    } catch (err) {
      console.error('[Guestbook] Error posting message:', err);
      alert('Network error. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Wedding Wish 💍';
      }
    }
  });
});
