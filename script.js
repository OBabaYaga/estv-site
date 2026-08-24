
// Cache DOM elements
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const navLinks = document.querySelectorAll('.nav-link');
const topbar = document.querySelector('.topbar');

// Toggle da sidebar (menu lateral) em ecrãs pequenos
function openSidebar() {
  if (sidebar) sidebar.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('visible');
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('visible');
}

function toggleSidebar() {
  if (sidebar && sidebar.classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

// Fecha a sidebar (em mobile) sempre que se clica num link do menu
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    closeSidebar();
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));

    if (target) {
      const topbarHeight = topbar ? topbar.offsetHeight : 0;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - topbarHeight - 16;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// Handle external links
document.querySelectorAll('[data-link]').forEach(element => {
  element.addEventListener('click', function() {
    window.open(this.getAttribute('data-link'), '_blank');
  });
});



// Add scroll effect to topbar
window.addEventListener('scroll', function() {
  if (!topbar) return;
  const currentScroll = window.pageYOffset;
  topbar.style.boxShadow = currentScroll <= 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
});

// Intersection Observer for fade-in animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
      entry.target.style.opacity = '1';
    }
  });
}, observerOptions);

// Observe elements for animations
document.querySelectorAll('.offer-card').forEach(el => {
  el.style.opacity = '0';
  observer.observe(el);
});

// Counter animation for stats
function animateCounter(element, target, duration = 2000) {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;
  const isFollowers = element.id === 'followerCount';
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      // Format the number - add '+' only for followers
      if (isFollowers) {
        element.textContent = '+' + formatNumber(target);
      } else {
        element.textContent = '+' + formatNumber(target);
      }
      clearInterval(timer);
    } else {
      // Format the number - add '+' only for followers
      if (isFollowers) {
        element.textContent = '+' + formatNumber(Math.floor(current));
      } else {
        element.textContent = '+' + formatNumber(Math.floor(current));
      }
    }
  }, 16);
}

// Format number with K/M suffix
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    return num.toString();
  }
}

// Fetch real-time follower count from Twitch using DecAPI
function fetchFollowerCount() {
  const followerElement = document.getElementById('followerCount');
  
  if (!followerElement) return;
  
  // Using DecAPI - a free API that provides Twitch stats
  fetch('https://decapi.me/twitch/followcount/edu___silva')
    .then(response => response.text())
    .then(count => {
      const followerCount = parseInt(count.trim());
      
      if (!isNaN(followerCount)) {
        // Animate the counter
        animateCounter(followerElement, followerCount, 2000);
      } else {
        // Fallback if API returns non-number
        followerElement.textContent = '1K+';
        console.warn('Could not parse follower count:', count);
      }
    })
    .catch(err => {
      console.error('Error fetching follower count:', err);
      followerElement.textContent = '1K+';
    });
}

// Update follower count periodically (every 5 minutes)
function startFollowerUpdates() {
  // Fetch immediately
  fetchFollowerCount();
  
  // Then update every 5 minutes (300000ms)
  setInterval(fetchFollowerCount, 300000);
}

// Observe stats section for counter animation
const statsObserver = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const statValues = entry.target.querySelectorAll('.ticker-value[data-target]');
      statValues.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        animateCounter(stat, target);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.hero-ticker');
if (statsSection) {
  statsObserver.observe(statsSection);
}

// Parallax effect for hero background
window.addEventListener('scroll', function() {
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    const scrolled = window.pageYOffset;
    heroBg.style.transform = `translateX(-50%) translateY(${scrolled * 0.5}px)`;
  }
});

// Add active state to navigation based on scroll position
function updateActiveNavLink() {
  const sections = document.querySelectorAll('section[id]');
  const topbarHeight = topbar ? topbar.offsetHeight : 0;

  sections.forEach(section => {
    const sectionTop = section.offsetTop - topbarHeight - 100;
    const sectionBottom = sectionTop + section.offsetHeight;
    const scrollPosition = window.pageYOffset;
    
    if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
      navLinks.forEach(link => link.classList.remove('active'));
      
      const currentLink = document.querySelector(`.nav-link[href$="#${section.id}"]`);
      if (currentLink) {
        currentLink.classList.add('active');
      }
    }
  });
}


window.addEventListener('scroll', updateActiveNavLink);

// Check if stream is live FIRST, then decide whether to load embed
function checkStreamStatus() {
  checkTwitchStreamStatus();
}

// Track stream state to avoid unnecessary reloads
let currentStreamState = null;

// Carregar o embed do Twitch (only called when stream is live)
let twitchEmbed = null;

function loadTwitchEmbed() {
  const container = document.getElementById('twitch-embed-container');
  if (!container) return;

  const parent = window.location.hostname;

  container.innerHTML = '';

  try {
    if (!window.Twitch || !window.Twitch.Embed) {
      loadTwitchIframe();
      return;
    }

    twitchEmbed = new Twitch.Embed('twitch-embed-container', {
      channel: 'edu___silva',
      width: '100%',
      height: '100%',
      parent: [parent]
    });

  } catch (e) {
    console.error('Erro no embed, usando iframe:', e);
    loadTwitchIframe();
  }
}


// Load Twitch iframe directly (fallback)
function loadTwitchIframe() {
  const container = document.getElementById('twitch-embed-container');
  if (!container) return;


  // Clear any offline card first
  const offlineCard = document.getElementById('offlineCard');
  if (offlineCard) {
    offlineCard.classList.remove('visible');
    offlineCard.style.display = 'none';
  }

  // Simple iframe - Twitch player
  // "parent" tem de incluir o domínio real a partir do qual a página está
  // a ser servida, senão a Twitch recusa o embed.
  const parent = window.location.hostname || 'www.estv.pt';
  container.innerHTML = `
    <iframe
      src="https://player.twitch.tv/?channel=edu___silva&parent=${parent}&parent=www.estv.pt&parent=estv.pt"
      height="100%"
      width="100%"
      frameborder="0"
      allowfullscreen="true">
    </iframe>
  `;
}



// Check stream status using DecAPI (works without API key, CORS-friendly)
function checkTwitchStreamStatus() {
  // Use a simpler endpoint that returns just 0 (offline) or 1 (online)
  fetch('https://decapi.me/twitch/uptime/edu___silva')
    .then(response => response.text())
    .then(status => {
      const statusText = status.trim();
      
      // DecAPI returns "-1" or error message if offline, or uptime in seconds if online
      const isOffline = statusText === '-1' || 
                        statusText.toLowerCase().includes('offline') || 
                        statusText.toLowerCase().includes('error') ||
                        statusText === '';
      
      
      // Only update if state changed
      const newState = isOffline ? 'offline' : 'online';
      if (currentStreamState !== newState) {
        currentStreamState = newState;
        
        if (isOffline) {
          // Clear the embed container when offline
          const container = document.getElementById('twitch-embed-container');
          if (container) {
            container.innerHTML = '';
          }
          showOfflineCard();
        } else {
          // Load player when stream is confirmed live
          loadTwitchIframe();
          showStream();
        }
      }
    })
    .catch(err => {
      console.error('Could not check stream status:', err);
      // On error, keep showing offline card (safer default)
      if (currentStreamState !== 'offline') {
        currentStreamState = 'offline';
        showOfflineCard();
      }
    });
}

// Load Twitch embed script dynamically only when needed
function loadTwitchScript() {
  return new Promise((resolve, reject) => {
    if (window.Twitch && window.Twitch.Embed) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://embed.twitch.tv/embed.js';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load Twitch script');
      reject();
    };
    document.head.appendChild(script);
  });
}

// Show the offline card overlay
function showOfflineCard() {
  window.ESTV_STREAM_LIVE = false;
  const offlineCard = document.getElementById('offlineCard');
  const liveBadge = document.getElementById('liveBadge');
  const liveText = document.getElementById('liveText');

  if (offlineCard) {
    offlineCard.classList.add('visible');
  }
  
  if (liveBadge) {
    liveBadge.classList.remove('live-active');
  }
  
  if (liveText) {
    liveText.textContent = 'OFFLINE';
  }
  
}

// Hide offline card and show stream
function showStream() {
  window.ESTV_STREAM_LIVE = true;
  const offlineCard = document.getElementById('offlineCard');
  const liveBadge = document.getElementById('liveBadge');
  const liveText = document.getElementById('liveText');

  if (offlineCard) {
    offlineCard.classList.remove('visible');
  }
  
  if (liveBadge) {
    liveBadge.classList.add('live-active');
  }
  
  if (liveText) {
    liveText.textContent = 'AO VIVO';
  }
  
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function initializeApp() {
  
  // Show offline card initially
  showOfflineCard();
  
  // Start real-time follower count updates
  startFollowerUpdates();
  
  // Check stream status immediately (don't wait for Twitch API)
  checkStreamStatus();
  
  // Re-check stream status periodically
  setInterval(function() {
    checkStreamStatus();
  }, 20000);
  
  updateActiveNavLink();
  initHeroCarousel();
  updateSiteStatsTicker();
  initMiniBetslip();
}

// Boletim de apostas decorativo no primeiro slide do carrossel — só
// visual (não mexe em pontos nem em jornadas reais), mas responde ao
// clique para dar sensação de interatividade antes de a pessoa entrar
// na página de Apostas a sério.
function initMiniBetslip() {
  const picks = document.querySelectorAll('.mini-betslip-picks .pick-btn');
  picks.forEach((btn) => {
    btn.addEventListener('click', () => {
      picks.forEach((b) => b.classList.remove('pick-selected'));
      btn.classList.add('pick-selected');
    });
  });
}

// Preenche os números de "Pontos Distribuídos" e "Jornadas" na hero
// ticker da página inicial (ficavam presos em "--" porque nada os
// atualizava). O total de pontos é o total guardado localmente — se
// ESTV_CONFIG.REMOTE_POINTS estiver ligado, os saldos "a sério" vivem no
// StreamElements e este número deixa de refletir o total real distribuído.
function updateSiteStatsTicker() {
  if (typeof ESTVData === 'undefined') return;

  const jornadasEl = document.getElementById('jornadasStat');
  if (jornadasEl) {
    ESTVData.getJornadas()
      .then((jornadas) => {
        jornadasEl.textContent = '+' + jornadas.length;
      })
      .catch((e) => {
        console.error('Could not load jornadas count:', e);
      });
  }

  const pointsEl = document.getElementById('totalPointsStat');
  if (pointsEl) {
    try {
      pointsEl.textContent = '+' + formatNumber(ESTVData.getTotalPointsDistributed());
    } catch (e) {
      console.error('Could not load total points:', e);
    }
  }
}

// ---------------------------------------------------------------
// Carrossel de destaques (só existe na página inicial — nas outras
// páginas .hero-carousel não existe e esta função não faz nada)
// ---------------------------------------------------------------
function initHeroCarousel() {
  const carousel = document.getElementById('heroCarousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
  const dotsWrap = document.getElementById('carouselDots');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (slides.length === 0) return;

  let current = 0;
  let autoplayId = null;

  if (dotsWrap) {
    dotsWrap.innerHTML = slides
      .map((_, i) => `<button type="button" class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Destaque ${i + 1}"></button>`)
      .join('');
  }
  const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('.carousel-dot')) : [];

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayId = setInterval(next, 6000);
  }

  function stopAutoplay() {
    if (autoplayId) clearInterval(autoplayId);
    autoplayId = null;
  }

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); startAutoplay(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startAutoplay(); });
  dots.forEach((dot) => {
    dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index, 10)); startAutoplay(); });
  });

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);

  goTo(0);
  startAutoplay();
}
