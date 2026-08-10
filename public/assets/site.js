const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
toggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  document.body.classList.remove('menu-open');
  toggle?.setAttribute('aria-expanded', 'false');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible'));
}, { threshold: 0.12 });
document.querySelectorAll('.section, .technical-list article, .portal-callout, .empty-editorial, .contact-form, .content-card, .rep-card, .split-panel, .page-cta, .editorial-box, .innovation-copy').forEach((element, index) => {
  element.classList.add('scroll-reveal', index % 2 === 0 ?'from-right' : 'from-left');
});
document.querySelectorAll('.reveal, .scroll-reveal').forEach((element) => observer.observe(element));

const header = document.querySelector('.site-header');
const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const heroVisual = document.querySelector('.hero-visual');
const orbit = document.querySelector('.grid-orbit, .lohmann-l-motion');
const dataCard = document.querySelector('.data-card');
const worldEgg = document.querySelector('.world-egg');
const heroEggArt = document.querySelector('.hero-egg-art');
heroVisual?.addEventListener('pointermove', (event) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bounds = heroVisual.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  orbit?.style.setProperty('translate', `${x * 12}px ${y * 12}px`);
  dataCard?.style.setProperty('translate', `${x * -10}px ${y * -10}px`);
  worldEgg?.style.setProperty('translate', `${x * 12}px ${y * 10}px`);
  worldEgg?.style.setProperty('rotate', `${x * 2}deg`);
  heroEggArt?.style.setProperty('translate', `${x * 14}px ${y * 12}px`);
  heroEggArt?.style.setProperty('rotate', `${x * 2}deg`);
});

const stateNodes = document.querySelectorAll('.state-node');
const repList = document.querySelector('#rep-list');
const repStateName = document.querySelector('#rep-state-name');
const selectedStateLabel = document.querySelector('#selected-state-label');
const representativesMap = document.querySelector('.map-shell');
const repResetButton = document.querySelector('#rep-reset-button');
const representatives = window.LohmannRepresentatives || {};
const fallbackRepresentatives = window.LohmannFallbackRepresentatives || [];

const whatsappLink = (phone, name) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const number = digits.startsWith('55') ?digits : `55${digits}`;
  const message = encodeURIComponent(`Olá, vim pelo site da Lohmann do Brasil e gostaria de falar com ${name || 'um representante'}.`);
  return `https://wa.me/${number}?text=${message}`;
};

const buildRepresentativeCard = (rep) => {
  const image = rep.photo ?`<img src="${rep.photo}" alt="">` : rep.initials;
  const whatsapp = whatsappLink(rep.phone, rep.name);
  const phoneLink = whatsapp ?`<a class="whatsapp-link" href="${whatsapp}" target="_blank" rel="noopener">${rep.phone}</a>` : 'Não informado';
  const emailLink = rep.email ?`<a href="mailto:${rep.email}">${rep.email}</a>` : 'Não informado';
  return `
    <article class="rep-card">
      <div class="rep-photo">${image}</div>
      <div>
        <h3>${rep.name}</h3>
        <p>${rep.role}</p>
        <dl>
          <dt>Região</dt><dd>${rep.region}</dd>
          <dt>Cidade</dt><dd>${rep.city}</dd>
          <dt>WhatsApp</dt><dd>${phoneLink}</dd>
          <dt>E-mail</dt><dd>${emailLink}</dd>
        </dl>
      </div>
    </article>
  `;
};

const selectState = (node) => {
  if (!node || !repList || !repStateName || !selectedStateLabel) return;
  document.body.classList.add('representatives-active');
  stateNodes.forEach((state) => state.classList.remove('is-active'));
  node.classList.add('is-active');
  const uf = node.dataset.state;
  repStateName.textContent = node.dataset.name || uf;
  selectedStateLabel.textContent = uf;
  const list = representatives[uf] || fallbackRepresentatives;
  repList.innerHTML = list.map(buildRepresentativeCard).join('');
  repResetButton?.removeAttribute('hidden');
};

const resetRepresentatives = () => {
  if (!repList || !repStateName || !selectedStateLabel) return;
  document.body.classList.remove('representatives-active');
  stateNodes.forEach((state) => state.classList.remove('is-active'));
  repStateName.textContent = 'Clique em um estado';
  selectedStateLabel.textContent = '--';
  repList.innerHTML = '<p class="rep-empty">Clique em um estado no mapa para visualizar os representantes. A lista ficar\u00e1 fixa at\u00e9 voc\u00ea voltar ao mapa.</p>';
  repResetButton?.setAttribute('hidden', 'hidden');
};

stateNodes.forEach((node) => {
  node.addEventListener('click', () => selectState(node));
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectState(node);
    }
  });
});

if (repList && stateNodes.length) {
  resetRepresentatives();
}

repResetButton?.addEventListener('click', resetRepresentatives);

const cookieConsentKey = 'lohmann_cookie_consent';
if (!localStorage.getItem(cookieConsentKey)) {
  const banner = document.createElement('section');
  banner.className = 'cookie-consent';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Aviso de cookies');
  banner.innerHTML = `
    <div>
      <strong>Permissão de cookies</strong>
      <p>Utilizamos cookies necessórios para o funcionamento do site e para melhorar sua experiência de navegação. Ao continuar, você concorda com o uso desses cookies.</p>
    </div>
    <button type="button" class="button primary">Aceitar cookies</button>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('is-visible'));
  banner.querySelector('button')?.addEventListener('click', () => {
    localStorage.setItem(cookieConsentKey, 'accepted');
    banner.classList.remove('is-visible');
    window.setTimeout(() => banner.remove(), 300);
  });
}

