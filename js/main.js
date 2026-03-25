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

// Email signup forms
(function() {
  document.querySelectorAll('.email-form, .email-hero-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input && input.value) {
        const btn = form.querySelector('button');
        const original = btn ? btn.textContent : '';
        if (btn) {
          btn.textContent = '✓ Subscribed!';
          btn.style.background = '#00aa44';
        }
        // In production: send to email service API
        setTimeout(function() {
          if (btn) {
            btn.textContent = original;
            btn.style.background = '';
          }
          if (input) input.value = '';
        }, 3000);
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
