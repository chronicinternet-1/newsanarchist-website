// NewsAnarchist.com - Main JavaScript

// Mobile nav toggle
(function() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function() {
      nav.classList.toggle('open');
    });
  }
})();

// Email signup forms — connected to Brevo via Cloudflare Worker
(function() {
  const WORKER_URL = 'https://newsanarchist-subscribe.steve-5cb.workers.dev/subscribe';

  document.querySelectorAll('.email-form, .email-hero-form, .newsletter-form, form[data-newsletter]').forEach(function(form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (!input || !input.value) return;

      const email = input.value.trim();
      const btn = form.querySelector('button[type="submit"], button');
      const originalText = btn ? btn.textContent : '';

      if (btn) {
        btn.textContent = 'Subscribing...';
        btn.disabled = true;
      }

      try {
        const resp = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await resp.json();

        if (data.success) {
          form.innerHTML = '<p style="color:#4caf50;font-weight:bold;padding:8px 0">✅ You\'re in! Check your inbox for a welcome email.</p>';
        } else {
          if (btn) { btn.textContent = originalText; btn.disabled = false; }
          alert('Something went wrong. Please try again.');
        }
      } catch (err) {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
        alert('Connection error. Please try again.');
      }
    });
  });
})();

// Share buttons
(function() {
  document.querySelectorAll('.share-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const url = encodeURIComponent(window.location.href);
      const title = encodeURIComponent(document.title);
      let shareUrl = '';
      
      if (btn.classList.contains('share-x')) {
        shareUrl = 'https://x.com/intent/tweet?url=' + url + '&text=' + title;
      } else if (btn.classList.contains('share-fb')) {
        shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
      } else if (btn.classList.contains('share-reddit')) {
        shareUrl = 'https://reddit.com/submit?url=' + url + '&title=' + title;
      } else if (btn.classList.contains('share-email')) {
        shareUrl = 'mailto:?subject=' + title + '&body=' + url;
        window.location.href = shareUrl;
        return;
      }
      
      if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }
    });
  });
})();

// Lazy loading images (native)
(function() {
  document.querySelectorAll('img[data-src]').forEach(function(img) {
    img.setAttribute('loading', 'lazy');
    img.src = img.dataset.src;
  });
})();

// Reading time calculation
(function() {
  const body = document.querySelector('.article-body');
  const timeEl = document.querySelector('.reading-time');
  if (body && timeEl) {
    const words = body.innerText.split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    timeEl.textContent = minutes + ' min read';
  }
})();

// Active nav link
(function() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach(function(link) {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });
})();

// Duplicate ticker for seamless loop
(function() {
  const track = document.querySelector('.ticker-track');
  if (track) {
    const clone = track.innerHTML;
    track.innerHTML = clone + clone;
  }
})();
