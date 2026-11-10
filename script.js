/* ================================================================
   NEWS PORTAL — Public Website (SEO-Optimized RTDB Version)
   History API Router — SEO-friendly URLs
   v2.3 — Adsterra integrated (no duplicates)
   ================================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, get, set, update, push, remove,
  query, orderByChild, equalTo, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ================================================================
   FIREBASE + SITE CONFIG
   ================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyByj7ivxIa83NfcpZsHuHPQu4hX-KF_1pI",
  authDomain: "fir-e71c6.firebaseapp.com",
  databaseURL: "https://fir-e71c6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fir-e71c6",
  storageBucket: "fir-e71c6.firebasestorage.app",
  messagingSenderId: "121956148050",
  appId: "1:121956148050:web:7c69c2208289de1946908b"
};

const SITE = {
  baseUrl: 'https://bdjanala.netlify.app',
  defaultTitle: 'খবর বাংলা — সর্বশেষ খবর, বিশ্লেষণ ও প্রযুক্তি সংবাদ',
  defaultDesc: 'বাংলাদেশ ও বিশ্বের সর্বশেষ খবর, রাজনীতি, খেলাধুলা, প্রযুক্তি, বিনোদন ও লাইফস্টাইল।',
  defaultImage: 'https://bdjanala.netlify.app/og-image.jpg',
  siteName: 'Janala News',
  siteNameBn: 'খবর বাংলা',
  twitter: '@janalanews',
  locale: 'bn_BD'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ================================================================
   STATE
   ================================================================ */
const S = {
  settings: {}, posts: [], categories: [], pages: {}, ads: [],
  lang: 'bn', view: 'home',
  currentPost: null, currentCategoryId: null, currentPageSlug: null, searchQ: '',
  homeLimit: 9, allLimit: 9, catLimit: 9,
  featIndex: 0, featTimer: null,
  fontSize: 2, bookmarks: {}, user: null,
  ready: { posts: false, cats: false, settings: false, pages: false, ads: false },
  unsubs: []
};

/* ================================================================
   HELPERS
   ================================================================ */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const stripHtml = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };

function fmtDate(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const opts = S.lang === 'bn'
    ? {day:'numeric', month:'long', year:'numeric'}
    : {day:'numeric', month:'short', year:'numeric'};
  try { return d.toLocaleDateString(S.lang === 'bn' ? 'bn-BD' : 'en-US', opts); }
  catch(e){ return d.toDateString(); }
}
function fmtISO(ts){ try { return new Date(ts).toISOString(); } catch(e){ return ''; } }
function relTime(ts){
  if(!ts) return '';
  const d = Date.now() - ts;
  if(d < 60000) return S.lang === 'bn' ? 'এইমাত্র' : 'just now';
  const m = Math.floor(d/60000);
  if(m < 60) return S.lang === 'bn' ? m+' মিনিট আগে' : m+'m ago';
  const h = Math.floor(d/3600000);
  if(h < 24) return S.lang === 'bn' ? h+' ঘণ্টা আগে' : h+'h ago';
  const day = Math.floor(d/86400000);
  if(day < 30) return S.lang === 'bn' ? day+' দিন আগে' : day+'d ago';
  return fmtDate(ts);
}
function readingTime(text){
  const words = stripHtml(text).split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
function toast(msg, type){
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = '<span class="ti">' + (type === 'ok' ? '✓' : type === 'err' ? '✕' : type === 'warn' ? '⚠' : 'ℹ') + '</span><span>' + esc(msg) + '</span>';
  const wrap = $('#toasts');
  if(wrap) wrap.appendChild(el);
  setTimeout(()=>{
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(()=>el.remove(), 280);
  }, 3000);
}

/* ================================================================
   i18n
   ================================================================ */
const I18N = {
  bn: { home:'হোম', posts:'সব পোস্ট', contact:'যোগাযোগ', search:'সার্চ',
    noResults:'কিছু পাওয়া যায়নি', loading:'লোড হচ্ছে...', minRead:'মিনিট পড়া',
    views:'বার', related:'সম্পর্কিত পোস্ট', bookmark:'সংরক্ষণ', bookmarked:'সংরক্ষিত',
    share:'শেয়ার করুন', copyLink:'লিংক কপি' },
  en: { home:'Home', posts:'Posts', contact:'Contact', search:'Search',
    noResults:'No results', loading:'Loading...', minRead:'min read',
    views:'views', related:'Related posts', bookmark:'Bookmark', bookmarked:'Bookmarked',
    share:'Share', copyLink:'Copy link' }
};
function t(k){ return (I18N[S.lang] || I18N.bn)[k] || k; }

function applyLang(lang){
  S.lang = lang === 'en' ? 'en' : 'bn';
  try { localStorage.setItem('np_lang', S.lang); } catch(e){}
  document.documentElement.setAttribute('lang', S.lang);
  const lab = $('#langLabel');
  if(lab) lab.textContent = S.lang === 'bn' ? 'EN' : 'বাং';
  rerender();
}
window.toggleLang = function(){ applyLang(S.lang === 'bn' ? 'en' : 'bn'); };
(function initLang(){
  let l = 'bn';
  try { l = localStorage.getItem('np_lang') || 'bn'; } catch(e){}
  S.lang = l === 'en' ? 'en' : 'bn';
  document.documentElement.setAttribute('lang', S.lang);
  const lab = $('#langLabel');
  if(lab) lab.textContent = S.lang === 'bn' ? 'EN' : 'বাং';
})();

/* ================================================================
   THEME
   ================================================================ */
function applyTheme(th){
  document.documentElement.setAttribute('data-theme', th);
  try { localStorage.setItem('np_theme', th); } catch(e){}
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', th === 'dark' ? '#0B1120' : '#C8102E');
  const icon = $('#themeIcon');
  if(icon){
    icon.innerHTML = th === 'dark'
      ? '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>';
  }
}
window.toggleTheme = function(){
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
};
(function initTheme(){
  let th = 'light';
  try { th = localStorage.getItem('np_theme') || 'light'; } catch(e){}
  applyTheme(th);
})();

/* ================================================================
   MOBILE MENU + NAV
   ================================================================ */
window.toggleMenu = function(){
  const m = $('#mobMenu');
  if(m) m.classList.toggle('open');
};
function renderNav(){
  const navItems = [
    { id:'home', label: t('home') },
    { id:'posts', label: t('posts') },
    { id:'contact', label: t('contact') }
  ];
  S.categories.forEach(c => navItems.push({ id:'category:' + c.id, label: c.name || '' }));
  Object.entries(S.pages).forEach(([slug,p]) => {
    if(p.showInMenu !== false && p.status !== 'draft'){
      navItems.push({ id:'page:' + slug, label: p.title || slug });
    }
  });

  const isActive = id => {
    if(id.startsWith('category:')) return S.view === 'category' && S.currentCategoryId === id.split(':')[1];
    if(id.startsWith('page:')) return S.view === 'page' && S.currentPageSlug === id.split(':')[1];
    return S.view === id;
  };

  const desktop = navItems.map(n => {
    let onclick = '';
    if(n.id.startsWith('category:')) onclick = `go('category','${n.id.split(':')[1]}')`;
    else if(n.id.startsWith('page:')) onclick = `go('page','${n.id.split(':')[1]}')`;
    else onclick = `go('${n.id}')`;
    return `<a onclick="${onclick}" class="${isActive(n.id)?'on':''}">${esc(n.label)}</a>`;
  }).join('');
  const el = $('#mainNav');
  if(el) el.innerHTML = desktop;

  const mobile = navItems.map(n => {
    let onclick = '';
    if(n.id.startsWith('category:')) onclick = `closeMob('category','${n.id.split(':')[1]}')`;
    else if(n.id.startsWith('page:')) onclick = `closeMob('page','${n.id.split(':')[1]}')`;
    else onclick = `closeMob('${n.id}')`;
    return `<a onclick="${onclick}" class="${isActive(n.id)?'on':''}">${esc(n.label)}</a>`;
  }).join('');
  const mel = $('#mobNav');
  if(mel) mel.innerHTML = mobile;
}
window.closeMob = function(view, id){ window.toggleMenu(); go(view, id); };

/* ================================================================
   SEO ENGINE
   ================================================================ */
const ROBOTS_INDEX   = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
const ROBOTS_NOINDEX = 'noindex, nofollow';

function setRobots(content){
  let el = document.querySelector('meta[name="robots"]');
  if(!el){
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMeta(selector, attr, value){
  if(!value) return;
  let el = document.querySelector(selector);
  if(!el){
    el = document.createElement('meta');
    const m = selector.match(/^meta\[(.+?)=["']?(.+?)["']?\]$/);
    if(m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}
function setById(id, val){ const el = document.getElementById(id); if(el) el.setAttribute('content', val); }
function setText(sel, txt){ const el = $(sel); if(el) el.textContent = txt; }

function buildUrl(view, id){
  if(view === 'home' || !view) return SITE.baseUrl + '/';
  if(view === 'search') return SITE.baseUrl + '/search';
  if(!id) return SITE.baseUrl + '/' + view;
  return SITE.baseUrl + '/' + view + '/' + encodeURIComponent(id);
}

function updateSEO({ title, description, image, url, type }){
  title = title || SITE.defaultTitle;
  description = description || SITE.defaultDesc;
  image = (image && /^https?:\/\//i.test(image)) ? image : SITE.defaultImage;
  url = url || SITE.baseUrl + '/';
  url = url.replace(/([^:]\/)\/+/g, '$1');

  document.title = title;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:image"]', 'content', image);
  setMeta('meta[property="og:image:secure_url"]', 'content', image);
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('meta[property="og:type"]', 'content', type || 'website');
  setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('meta[name="twitter:image"]', 'content', image);

  setById('ogTitle', title);
  setById('ogDesc', description);
  setById('ogImage', image);
  setById('ogImageSecure', image);
  setById('ogUrl', url);
  setById('twTitle', title);
  setById('twDesc', description);
  setById('twImage', image);

  let canonical = document.getElementById('canonicalLink');
  if(!canonical){
    canonical = document.querySelector('link[rel="canonical"]');
    if(!canonical){
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.id = 'canonicalLink';
      document.head.appendChild(canonical);
    }
  }
  canonical.setAttribute('href', url);

  if((type || 'website') !== 'article'){
    const ap = document.getElementById('artPublished');
    const am = document.getElementById('artModified');
    if(ap) ap.setAttribute('content', '');
    if(am) am.setAttribute('content', '');
  }
}

function injectSchema(schemaObj){
  let el = document.getElementById('viewSchema');
  if(!el){
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'viewSchema';
    document.head.appendChild(el);
  }
  if(!schemaObj){
    el.remove();
    return;
  }
  el.textContent = JSON.stringify(schemaObj);
}

function breadcrumbSchema(items){
  return {
    "@type": "BreadcrumbList",
    "itemListElement": items.map((it, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": it.name,
      "item": it.url
    }))
  };
}

function seoHome(){
  const s = S.settings || {};
  const site = s.siteName || SITE.siteNameBn;
  const title = s.metaTitle || `${site} — সর্বশেষ খবর, বিশ্লেষণ ও প্রযুক্তি সংবাদ`;
  const desc = s.metaDescription || SITE.defaultDesc;
  const url = SITE.baseUrl + '/';
  const image = s.logo && /^https?:\/\//i.test(s.logo) ? s.logo : SITE.defaultImage;

  updateSEO({ title, description: desc, image, url, type: 'website' });

  injectSchema({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url + "#webpage",
    "url": url,
    "name": title,
    "isPartOf": { "@id": SITE.baseUrl + "/#website" },
    "inLanguage": "bn-BD"
  });
}

function seoPost(post){
  const c = catOf(post);
  const title = (post.seoTitle || post.title || '') + ' — ' + (S.settings.siteName || SITE.siteNameBn);
  const desc = post.seoDescription || post.excerpt || stripHtml(post.body).slice(0, 155);
  const url = buildUrl('post', post.id);
  const image = post.image;

  updateSEO({ title, description: desc, image, url, type: 'article' });

  setById('artPublished', fmtISO(post.publishedAt || post.createdAt));
  setById('artModified', fmtISO(post.updatedAt || post.publishedAt || post.createdAt));

  const authorName = post.author || S.settings.author || SITE.siteNameBn;
  const breadcrumbs = [{ name: 'হোম', url: SITE.baseUrl + '/' }];
  if(c) breadcrumbs.push({ name: c.name, url: c.id ? buildUrl('category', c.id) : SITE.baseUrl + '/' });
  breadcrumbs.push({ name: post.title || '', url });

  injectSchema({
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbSchema(breadcrumbs),
      {
        "@type": "NewsArticle",
        "@id": url + "#article",
        "headline": (post.title || '').slice(0, 110),
        "description": desc,
        "image": image ? [image] : [SITE.defaultImage],
        "datePublished": fmtISO(post.publishedAt || post.createdAt),
        "dateModified": fmtISO(post.updatedAt || post.publishedAt || post.createdAt),
        "author": { "@type": "Person", "name": authorName },
        "publisher": {
          "@type": "Organization",
          "name": S.settings.siteName || SITE.siteNameBn,
          "logo": {
            "@type": "ImageObject",
            "url": (S.settings.logo && /^https?:\/\//i.test(S.settings.logo)) ? S.settings.logo : SITE.defaultImage
          }
        },
        "mainEntityOfPage": { "@type": "WebPage", "@id": url },
        "articleSection": c ? c.name : undefined,
        "inLanguage": "bn-BD",
        "keywords": Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '')
      }
    ]
  });
}

function seoCategory(cat){
  const title = cat ? `${cat.name} — ${S.settings.siteName || SITE.siteNameBn}` : 'ক্যাটাগরি';
  const desc = cat && cat.description ? cat.description : `"${cat ? cat.name : 'ক্যাটাগরি'}" বিভাগের সর্বশেষ খবর ও পোস্ট।`;
  const url = buildUrl('category', cat ? cat.id : '');
  const image = cat && cat.image;

  updateSEO({ title, description: desc, image, url, type: 'website' });

  const breadcrumbs = [
    { name: 'হোম', url: SITE.baseUrl + '/' },
    { name: cat ? cat.name : 'ক্যাটাগরি', url }
  ];

  injectSchema({
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbSchema(breadcrumbs),
      {
        "@type": "CollectionPage",
        "@id": url + "#webpage",
        "url": url,
        "name": title,
        "description": desc,
        "isPartOf": { "@id": SITE.baseUrl + "/#website" },
        "inLanguage": "bn-BD"
      }
    ]
  });
}

function seoSearch(q){
  const title = q ? `"${q}" — সার্চ ফলাফল — ${S.settings.siteName || SITE.siteNameBn}` : `সার্চ — ${S.settings.siteName || SITE.siteNameBn}`;
  const desc = q ? `"${q}" এর জন্য সার্চ ফলাফল।` : 'সাইটে খবর ও পোস্ট সার্চ করুন।';
  updateSEO({
    title, description: desc, image: SITE.defaultImage,
    url: SITE.baseUrl + '/search', type: 'website'
  });
  injectSchema({
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "url": SITE.baseUrl + '/search',
    "name": title,
    "inLanguage": "bn-BD"
  });
}

function seoPage(page){
  const title = (page.title || '') + ' — ' + (S.settings.siteName || SITE.siteNameBn);
  const desc = stripHtml(page.body).slice(0, 155) || SITE.defaultDesc;
  const url = buildUrl('page', page.id || page.slug);
  updateSEO({ title, description: desc, image: SITE.defaultImage, url, type: 'website' });

  const breadcrumbs = [
    { name: 'হোম', url: SITE.baseUrl + '/' },
    { name: page.title || '', url }
  ];

  const typeMap = {
    'about': 'AboutPage',
    'contact': 'ContactPage',
    'privacy': 'WebPage',
    'terms': 'WebPage'
  };
  const pageType = typeMap[page.id || page.slug] || 'WebPage';

  injectSchema({
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbSchema(breadcrumbs),
      {
        "@type": pageType,
        "@id": url + "#webpage",
        "url": url,
        "name": title,
        "description": desc,
        "isPartOf": { "@id": SITE.baseUrl + "/#website" },
        "inLanguage": "bn-BD"
      }
    ]
  });
}

function seoContact(){
  updateSEO({
    title: 'যোগাযোগ — ' + (S.settings.siteName || SITE.siteNameBn),
    description: 'যেকোনো প্রশ্ন, পরামর্শ বা অভিযোগ জানান। আমাদের সাথে যোগাযোগ করুন।',
    image: SITE.defaultImage,
    url: SITE.baseUrl + '/contact',
    type: 'website'
  });
  injectSchema({
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "url": SITE.baseUrl + '/contact',
    "name": 'যোগাযোগ',
    "inLanguage": "bn-BD"
  });
}

/* ================================================================
   ROUTER
   ================================================================ */
const VALID_VIEWS = ['home','posts','post','category','search','page','contact'];

function parsePath(){
  const path = location.pathname.replace(/^\/|\/$/g, '');
  const parts = path.split('/').filter(Boolean);

  if(!parts.length) return { view: 'home', id: null };

  if(/\.(html?|php|asp|aspx|jsp)$/i.test(parts[0])){
    return { view: 'home', id: null };
  }

  const view = parts[0];
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  if(view === 'search'){
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || '';
    return { view: 'search', id: null, q };
  }

  const STATIC_SLUGS = ['about', 'privacy', 'terms', 'disclaimer', 'faq', 'policy'];
  if(STATIC_SLUGS.includes(view)){
    return { view: 'page', id: view };
  }

  if(!VALID_VIEWS.includes(view)) return { view: '404', id: null };

  return { view, id };
}

function buildPath(view, id){
  if(view === 'home' || !view) return '/';
  if(view === 'search'){
    const q = S.searchQ ? '?q=' + encodeURIComponent(S.searchQ) : '';
    return '/search' + q;
  }
  if(!id) return '/' + view;
  return '/' + view + '/' + encodeURIComponent(id);
}

window.go = function(view, id, opts){
  opts = opts || {};
  if(view === 'category') S.currentCategoryId = id || null;
  if(view === 'page') S.currentPageSlug = id || null;

  const path = buildPath(view, id);

  if(location.pathname + location.search === path){
    route();
    return;
  }

  if(opts.replace){
    history.replaceState({ view, id }, '', path);
  } else {
    history.pushState({ view, id }, '', path);
  }
  route();
};

window.addEventListener('popstate', function(){
  route();
  setTimeout(renderAds, 60);
});

function route(){
  if(window.__auto404Timer){ clearTimeout(window.__auto404Timer); window.__auto404Timer = null; }

  const { view, id, q } = parsePath();
  S.view = view || 'home';

  if(S.view === 'search' && typeof q === 'string' && q !== S.searchQ){
    S.searchQ = q;
  }

  // 404 handling
  if(S.view === '404'){
    $$('.view').forEach(v => v.classList.add('hide'));
    const notFound = document.getElementById('v-notfound');
    if(notFound){
      notFound.classList.remove('hide');
    } else {
      history.replaceState(null, '', '/');
      S.view = 'home';
      const homeEl = document.getElementById('v-home');
      if(homeEl) homeEl.classList.remove('hide');
    }

    setRobots(ROBOTS_NOINDEX);
    let canonical = document.getElementById('canonicalLink');
    if(canonical) canonical.setAttribute('href', SITE.baseUrl + '/');
    injectSchema(null);

    document.title = 'পেজ পাওয়া যায়নি — ' + (S.settings.siteName || SITE.siteNameBn);
    renderNav();

    clearTimeout(window.__auto404Timer);
    window.__auto404Timer = setTimeout(() => {
      if(S.view === '404') go('home', null, { replace: true });
    }, 3000);

    return;
  }

  setRobots(ROBOTS_INDEX);

  $$('.view').forEach(v => v.classList.add('hide'));
  const el = document.getElementById('v-' + S.view);
  if(el) el.classList.remove('hide');
  const mob = $('#mobMenu');
  if(mob) mob.classList.remove('open');

  try {
    if(S.view === 'home'){
      renderHome();
      seoHome();
    }
    if(S.view === 'posts'){
      renderAllPosts(true);
      updateSEO({
        title: 'সব পোস্ট — ' + (S.settings.siteName || SITE.siteNameBn),
        description: 'সাইটের সব খবর ও পোস্ট একসাথে।',
        url: SITE.baseUrl + '/posts',
        type: 'website'
      });
      injectSchema({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": SITE.baseUrl + '/posts#webpage',
        "url": SITE.baseUrl + '/posts',
        "name": 'সব পোস্ট',
        "isPartOf": { "@id": SITE.baseUrl + "/#website" },
        "inLanguage": "bn-BD"
      });
    }
    if(S.view === 'post'){
      if(S.ready.posts){
        renderPost(id);
      } else {
        const pel = $('#postContainer');
        if(pel) pel.innerHTML = `<div class="loading"><div class="spinner"></div><div>${t('loading')}</div></div>`;
      }
    }
    if(S.view === 'category') renderCategory(id, true);
    if(S.view === 'search')   renderSearch();
    if(S.view === 'page')     renderPage(id);
    if(S.view === 'contact')  seoContact();
  } catch(e){ console.error('route error', e); }

  renderNav();
  renderAds();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function rerender(){ try{ route(); }catch(e){ console.warn(e); } }

/* ================================================================
   REALTIME LISTENERS
   ================================================================ */
function listenSettings(){
  const r = ref(db, 'settings/site');
  const unsub = onValue(r, snap => {
    S.settings = snap.val() || {};
    S.ready.settings = true;
    applySettings();
    rerender();
  }, err => {
    console.warn('[settings]', err);
    S.ready.settings = true;
    applySettings();
  });
  S.unsubs.push(unsub);
}

function listenCategories(){
  const r = ref(db, 'categories');
  const unsub = onValue(r, snap => {
    const val = snap.val() || {};
    S.categories = Object.entries(val).map(([id, c]) => ({id, ...c}))
      .filter(c => c.status !== 'draft')
      .sort((a,b) => num(a.order) - num(b.order));
    S.ready.cats = true;
    renderNav();
    rerender();
  }, err => { console.warn('[categories]', err); S.categories = []; S.ready.cats = true; });
  S.unsubs.push(unsub);
}

function listenPosts(){
  const r = ref(db, 'posts');
  const unsub = onValue(r, snap => {
    const val = snap.val() || {};
    S.posts = Object.entries(val).map(([id, p]) => ({id, ...p}))
      .filter(p => p.status !== 'draft')
      .sort((a,b) => num(b.publishedAt || b.createdAt) - num(a.publishedAt || a.createdAt));
    S.ready.posts = true;
    renderNav();
    rerender();
  }, err => { console.warn('[posts]', err); S.posts = []; S.ready.posts = true; });
  S.unsubs.push(unsub);
}

function listenPages(){
  const r = ref(db, 'pages');
  const unsub = onValue(r, snap => {
    const val = snap.val() || {};
    S.pages = {};
    Object.entries(val).forEach(([slug, p]) => {
      if(p.status !== 'draft') S.pages[slug] = {id: slug, ...p};
    });
    S.ready.pages = true;
    renderFooterPages();
    renderNav();
    rerender();
  }, err => { console.warn('[pages]', err); S.ready.pages = true; renderFooterPages(); });
  S.unsubs.push(unsub);
}

function listenAds(){
  const r = ref(db, 'ads');
  const unsub = onValue(r, snap => {
    const val = snap.val() || {};
    S.ads = Object.entries(val).map(([id, a]) => ({id, ...a}))
      .filter(a => a.active !== false)
      .sort((a,b) => {
        const oa = num(a.order), ob = num(b.order);
        if(oa !== ob) return oa - ob;
        return num(a.createdAt) - num(b.createdAt);
      });
    S.ready.ads = true;
    renderAds();
  }, err => { console.warn('[ads]', err); S.ads = []; S.ready.ads = true; renderAds(); });
  S.unsubs.push(unsub);
}

function renderAds(){
  const slots = $$('.ad-slot[data-ad-slot]');
  slots.forEach(slot => {
    const slotKey = slot.dataset.adSlot;
    const matching = S.ads.filter(a => (a.position || 'home-2') === slotKey);
    if(matching.length){
      slot.className = 'ad-slot show';
      slot.innerHTML = matching.map(ad => `
        <div class="ad-item">
          <span class="ad-badge">বিজ্ঞাপন</span>
          ${ad.url ? `<a href="${esc(ad.url)}" target="_blank" rel="noopener sponsored nofollow">` : ''}
            ${ad.image
              ? `<img src="${esc(ad.image)}" alt="${esc(ad.title||'Advertisement')}" loading="lazy"
                  onerror="this.closest('.ad-item').style.display='none'">`
              : `<div class="ad-placeholder">📢 ${esc(ad.title||'Advertisement')}</div>`}
          ${ad.url ? `</a>` : ''}
        </div>
      `).join('');
    } else {
      slot.className = 'ad-slot';
      slot.innerHTML = '';
    }
  });
}

function applySettings(){
  const s = S.settings || {};
  const name = s.siteName || 'খবর বাংলা';

  setText('#brandName', name);
  setText('#footName', name);
  setText('#copyName', name);
  setText('#mobBrand', name);

  setText('#brandTag', s.tagline || 'সর্বশেষ খবর ও বিশ্লেষণ');

  if(s.logo && /^https?:\/\//i.test(s.logo)){
    const bl = $('#brandLogo');
    if(bl) bl.innerHTML = `<img src="${esc(s.logo)}" alt="${esc(name)} লোগো" onerror="this.parentNode.textContent='খ'">`;
    const fl = $('#footLogo');
    if(fl) fl.innerHTML = `<img src="${esc(s.logo)}" alt="${esc(name)} লোগো" onerror="this.parentNode.textContent='খ'">`;
  } else {
    const initial = (name[0] || 'খ').toUpperCase();
    setText('#brandLogo', initial);
    setText('#footLogo', initial);
  }

  if(s.description) setText('#footDesc', s.description);
  if(s.email) setText('#footEmail', '✉️ ' + s.email);
  if(s.phone) setText('#footPhone', '📞 ' + s.phone);
  if(s.address) setText('#footAddr', '📍 ' + s.address);

  const socialsHTML = buildSocials(s);
  const ts = $('#topSocials');
  if(ts) ts.innerHTML = socialsHTML.top;
  const fs = $('#footSocials');
  if(fs) fs.innerHTML = socialsHTML.foot;

  const topDate = $('#topDate');
  if(topDate){
    const d = new Date();
    const days = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
    const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    topDate.textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  const cy = $('#copyYear');
  if(cy) cy.textContent = new Date().getFullYear();
}
function buildSocials(s){
  const list = [];
  if(s.facebook)  list.push({ k:'f', url:s.facebook, label:'Facebook' });
  if(s.twitter)   list.push({ k:'𝕏', url:s.twitter, label:'Twitter' });
  if(s.youtube)   list.push({ k:'▶', url:s.youtube, label:'YouTube' });
  if(s.instagram) list.push({ k:'📷', url:s.instagram, label:'Instagram' });
  if(s.whatsapp)  list.push({ k:'💬', url:s.whatsapp, label:'WhatsApp' });
  if(s.telegram)  list.push({ k:'✈', url:s.telegram, label:'Telegram' });
  const make = arr => arr.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${x.label}">${x.k}</a>`).join('');
  return { top: make(list), foot: make(list) };
}
function renderFooterPages(){
  const el = $('#footPages');
  if(!el) return;
  const items = Object.entries(S.pages)
    .filter(([slug,p]) => p.status !== 'draft')
    .map(([slug,p]) => `<li><a onclick="go('page','${esc(slug)}')">${esc(p.title||slug)}</a></li>`);
  if(!items.length){
    items.push(`<li><a onclick="go('page','about')">আমাদের সম্পর্কে</a></li>`);
    items.push(`<li><a onclick="go('page','privacy')">প্রাইভেসি</a></li>`);
    items.push(`<li><a onclick="go('page','terms')">শর্তাবলী</a></li>`);
  }
  el.innerHTML = items.join('');
}

/* ================================================================
   RENDER HELPERS
   ================================================================ */
function catOf(post){
  if(post.categoryId){
    const c = S.categories.find(x => x.id === post.categoryId);
    if(c) return c;
  }
  if(post.category){
    const c = S.categories.find(x => x.name === post.category);
    if(c) return c;
    return { id: null, name: post.category };
  }
  return null;
}
function postInCategory(post, catId, catName){
  if(post.categoryId && post.categoryId === catId) return true;
  if(catName && post.category === catName) return true;
  return false;
}
function postImgHTML(post, eager){
  const img = post.image && /^https?:\/\//i.test(post.image) ? post.image : '';
  if(img){
    return `<img src="${esc(img)}" alt="${esc(post.title||'')}" loading="${eager?'eager':'lazy'}" ${eager?'fetchpriority="high"':''}
      onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\\'width:100%;height:100%;display:grid;place-items:center;color:var(--gray-l);font-size:42px\\'>📰</div>'">`;
  }
  return `<div style="width:100%;height:100%;display:grid;place-items:center;color:var(--gray-l);font-size:42px;background:var(--soft)">📰</div>`;
}
function pcardHTML(post){
  const c = catOf(post);
  const exc = post.excerpt || stripHtml(post.body).slice(0, 130);
  return `
    <article class="pcard" onclick="go('post','${esc(post.id)}')" itemscope itemtype="https://schema.org/NewsArticle">
      <div class="img">
        ${postImgHTML(post)}
        ${c ? `<span class="cat">${esc(c.name)}</span>` : ''}
      </div>
      <div class="body">
        <h3 itemprop="headline">${esc(post.title||'')}</h3>
        <p class="excerpt" itemprop="description">${esc(exc)}</p>
        <div class="meta">
          ${post.author ? `<b itemprop="author">${esc(post.author)}</b>` : ''}
          ${post.publishedAt ? `<span>•</span><time itemprop="datePublished" datetime="${fmtISO(post.publishedAt)}">${esc(relTime(post.publishedAt))}</time>` : ''}
          <span>•</span><span>${readingTime(post.body)} ${t('minRead')}</span>
        </div>
      </div>
    </article>`;
}
function sitemHTML(post, idx){
  return `
    <div class="sitem" onclick="go('post','${esc(post.id)}')">
      <div class="num">${idx + 1}</div>
      <div class="info">
        <h4>${esc(post.title||'')}</h4>
        <div class="meta">${esc(relTime(post.publishedAt||post.createdAt))} • ${readingTime(post.body)} ${t('minRead')}</div>
      </div>
    </div>`;
}
function gridHTML(list, emptyTitle){
  if(!list.length){
    return `<div class="empty" style="grid-column:1/-1">
      <div class="ei">📭</div>
      <h4>${esc(emptyTitle || 'কোনো পোস্ট নেই')}</h4>
      <p>এই বিভাগে এখনো কোনো পোস্ট প্রকাশিত হয়নি।</p>
    </div>`;
  }
  return list.map(pcardHTML).join('');
}

/* ================================================================
   TICKER
   ================================================================ */
function applyTickerKeyframes(n){
  const ti = document.getElementById('tickerItems');
  const old = document.getElementById('tickerKf');

  if(!ti) return;

  if(!n || n < 2){
    if(old) old.remove();
    ti.style.animation = 'none';
    return;
  }

  const H = 44;
  let kf = '@keyframes tickDyn{';
  for(let i = 0; i < n; i++){
    const start = (i * 100 / n).toFixed(2);
    const end   = Math.max(0, (i + 1) * 100 / n - 2).toFixed(2);
    kf += `${start}%,${end}%{transform:translateY(${-i * H}px)}`;
  }
  kf += '100%{transform:translateY(0)}}';

  let styleEl = old;
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'tickerKf';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = kf;
  ti.style.animation = `tickDyn ${n * 4}s infinite`;
}

/* ================================================================
   HOME
   ================================================================ */
function renderHome(){
  const posts = S.posts.slice();
  const featured = posts.filter(p => p.featured).length
    ? posts.filter(p => p.featured).slice(0, 6)
    : posts.slice(0, 6);

  const track = $('#featTrack');
  const dots = $('#featDots');
  const prevBtn = $('#featPrev');
  const nextBtn = $('#featNext');

  if(track && dots){
    if(featured.length){
      track.innerHTML = featured.map((post, i) => {
        const c = catOf(post);
        return `
          <div class="feat-slide" onclick="go('post','${esc(post.id)}')">
            ${postImgHTML(post, i === 0)}
            <div class="ov">
              ${c ? `<span class="cat">${esc(c.name)}</span>` : ''}
              <h3>${esc(post.title||'')}</h3>
              <div class="meta">
                ${post.author ? `<b>${esc(post.author)}</b>` : ''}
                ${post.publishedAt ? `<span>•</span><span>${esc(fmtDate(post.publishedAt))}</span>` : ''}
                <span>•</span><span>${readingTime(post.body)} ${t('minRead')}</span>
              </div>
            </div>
          </div>`;
      }).join('');
      dots.innerHTML = featured.map((_,i) => `<span class="dot ${i===0?'on':''}" onclick="featGo(${i})" role="button" aria-label="Slide ${i+1}"></span>`).join('');
      if(prevBtn) prevBtn.style.display = featured.length > 1 ? '' : 'none';
      if(nextBtn) nextBtn.style.display = featured.length > 1 ? '' : 'none';
      startFeatAuto();
    } else if(S.ready.posts){
      track.innerHTML = `<div class="feat-slide" style="display:grid;place-items:center;background:var(--soft)">
        <div style="text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:12px">📰</div>
          <h3 style="color:var(--ink);margin:0">এখনো কোনো পোস্ট নেই</h3>
          <p style="color:var(--gray);margin:8px 0 0">অ্যাডমিন প্যানেল থেকে পোস্ট প্রকাশ করুন।</p>
        </div>
      </div>`;
      dots.innerHTML = '';
      if(prevBtn) prevBtn.style.display = 'none';
      if(nextBtn) nextBtn.style.display = 'none';
    } else {
      track.innerHTML = `<div class="skel" style="height:420px;flex:0 0 100%"></div>`;
      dots.innerHTML = '';
    }
  }

  const latest = posts.slice(0, S.homeLimit);
  const lg = $('#latestGrid');
  if(lg) lg.innerHTML = S.ready.posts
    ? gridHTML(latest)
    : Array(6).fill(0).map(() => `<div class="skel" style="height:300px"></div>`).join('');
  const lmBtn = $('#loadMoreBtn');
  if(lmBtn) lmBtn.style.display = (S.ready.posts && posts.length > S.homeLimit) ? '' : 'none';

  const ticker = $('#tickerWrap');
  const tickerItems = $('#tickerItems');
  if(ticker && tickerItems){
    const breaking = posts.filter(p => p.breaking).slice(0, 5);
    const list = breaking.length ? breaking : posts.slice(0, 5);
    if(list.length){
      ticker.style.display = 'flex';
      tickerItems.innerHTML = list.map(p =>
        `<a onclick="go('post','${esc(p.id)}')">${esc(p.title||'')}</a>`
      ).join('');
      applyTickerKeyframes(list.length);
    } else {
      ticker.style.display = 'none';
      applyTickerKeyframes(0);
    }
  }

  const popEl = $('#popularList');
  if(popEl){
    const popular = posts.slice().sort((a,b) => num(b.views) - num(a.views)).slice(0, 5);
    popEl.innerHTML = popular.length
      ? popular.map((p,i) => sitemHTML(p, i)).join('')
      : '<div class="muted small">এখনো কোনো ডেটা নেই</div>';
  }

  const trendEl = $('#trendingList');
  if(trendEl){
    const trend = posts.slice(0, 5);
    trendEl.innerHTML = trend.length
      ? trend.map((p,i) => sitemHTML(p, i)).join('')
      : '<div class="muted small">এখনো কোনো ডেটা নেই</div>';
  }

  const catListEl = $('#catList');
  if(catListEl){
    if(S.categories.length){
      catListEl.innerHTML = S.categories.map(c => {
        const count = posts.filter(p => postInCategory(p, c.id, c.name)).length;
        return `<a onclick="go('category','${esc(c.id)}')" style="display:flex;justify-content:space-between;padding:9px 12px;border-radius:8px;background:var(--bg-2);cursor:pointer;font-size:14px;font-weight:600;color:var(--ink-2);transition:.15s" onmouseover="this.style.background='var(--pri)';this.style.color='#fff'" onmouseout="this.style.background='var(--bg-2)';this.style.color='var(--ink-2)'">
          <span>${esc(c.icon||'📁')} ${esc(c.name)}</span>
          <span style="opacity:.7">${count}</span>
        </a>`;
      }).join('');
    } else catListEl.innerHTML = '<div class="muted small">এখনো কোনো ক্যাটাগরি নেই</div>';
  }

  const csEl = $('#catSections');
  if(csEl){
    if(S.categories.length){
      const html = S.categories.slice(0, 4).map(c => {
        const cPosts = posts.filter(p => postInCategory(p, c.id, c.name)).slice(0, 3);
        if(!cPosts.length) return '';
        return `
          <div class="section">
            <div class="sec-head">
              <h2>${esc(c.icon||'📁')} ${esc(c.name)}</h2>
              <a class="see" onclick="go('category','${esc(c.id)}')">সব দেখুন →</a>
            </div>
            <div class="grid">${cPosts.map(pcardHTML).join('')}</div>
          </div>`;
      }).filter(Boolean).join('');
      csEl.innerHTML = html;
    } else csEl.innerHTML = '';
  }

  setTimeout(renderAds, 80);
}

function startFeatAuto(){
  stopFeatAuto();
  const track = $('#featTrack');
  if(!track) return;
  const slides = track.querySelectorAll('.feat-slide');
  if(slides.length < 2) return;
  S.featTimer = setInterval(() => featNext(), 5000);
}
function stopFeatAuto(){ if(S.featTimer){ clearInterval(S.featTimer); S.featTimer = null; } }
window.featNext = function(){
  const track = $('#featTrack');
  if(!track) return;
  const count = track.querySelectorAll('.feat-slide').length;
  if(!count) return;
  S.featIndex = (S.featIndex + 1) % count;
  scrollToFeat();
};
window.featPrev = function(){
  const track = $('#featTrack');
  if(!track) return;
  const count = track.querySelectorAll('.feat-slide').length;
  if(!count) return;
  S.featIndex = (S.featIndex - 1 + count) % count;
  scrollToFeat();
};
window.featGo = function(i){ S.featIndex = i; scrollToFeat(); };
function scrollToFeat(){
  const track = $('#featTrack');
  if(!track) return;
  const slide = track.querySelectorAll('.feat-slide')[S.featIndex];
  if(!slide) return;
  track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  $$('#featDots .dot').forEach((d,i) => d.classList.toggle('on', i === S.featIndex));
}

/* ================================================================
   ALL POSTS
   ================================================================ */
function renderAllPosts(reset){
  if(reset) S.allLimit = 9;
  const list = S.posts.slice(0, S.allLimit);
  const el = $('#allPostsGrid');
  if(el) el.innerHTML = S.ready.posts
    ? gridHTML(list)
    : Array(6).fill(0).map(() => `<div class="skel" style="height:300px"></div>`).join('');
  const btn = $('#loadMoreAllBtn');
  if(btn) btn.style.display = (S.posts.length > S.allLimit) ? '' : 'none';
}
window.loadMoreAll = function(){ S.allLimit += 9; renderAllPosts(false); };
window.loadMore = function(){ S.homeLimit += 6; renderHome(); };
window.loadMoreCat = function(){ S.catLimit += 6; renderCategory(S.currentCategoryId, false); };

/* ================================================================
   SINGLE POST
   ================================================================ */
async function renderPost(pid){
  const el = $('#postContainer');
  if(!el) return;
  if(!pid){ go('home'); return; }
  el.innerHTML = `<div class="loading"><div class="spinner"></div><div>${t('loading')}</div></div>`;

  let post = S.posts.find(p => p.id === pid);
  if(!post){
    try {
      const snap = await get(ref(db, 'posts/' + pid));
      if(snap.exists()){
        const data = snap.val();
        if(data.status !== 'draft') post = { id: pid, ...data };
      }
    } catch(e){ console.warn('fetch post failed', e); }
  }

  if(!post){
    if(!S.ready.posts){
      el.innerHTML = `<div class="loading"><div class="spinner"></div><div>${t('loading')}</div></div>`;
      return;
    }
    el.innerHTML = `<div class="empty" style="padding:80px 20px">
      <div class="ei">🔎</div><h4>পোস্ট পাওয়া যায়নি</h4>
      <p>এটি মুছে ফেলা হয়েছে বা এখনো প্রকাশিত হয়নি।</p>
      <button class="btn-load" style="margin-top:24px" onclick="go('home')">হোমে ফিরুন</button>
    </div>`;
    updateSEO({ title: 'পোস্ট পাওয়া যায়নি — ' + (S.settings.siteName || SITE.siteNameBn) });
    injectSchema(null);
    setRobots(ROBOTS_NOINDEX);
    return;
  }
  S.currentPost = post;

  seoPost(post);
  setRobots(ROBOTS_INDEX);

  let viewCount = num(post.views) || 0;
  try {
    const vSnap = await get(ref(db, 'postStats/' + post.id + '/views'));
    if(vSnap.exists()) viewCount = num(vSnap.val());
  } catch(e){ /* ignore */ }

  const c = catOf(post);
  const tags = Array.isArray(post.tags)
    ? post.tags
    : (post.tags ? String(post.tags).split(',').map(x=>x.trim()).filter(Boolean) : []);
  const author = post.author || S.settings.author || 'সম্পাদক';
  const authorInitial = (author[0] || 'A').toUpperCase();

  incrementViews(post.id);

  const related = S.posts
    .filter(p => p.id !== post.id && postInCategory(p, post.categoryId, post.category))
    .slice(0, 3);

  const idx = S.posts.findIndex(p => p.id === post.id);
  const prevPost = idx > 0 ? S.posts[idx - 1] : null;
  const nextPost = idx >= 0 && idx < S.posts.length - 1 ? S.posts[idx + 1] : null;

  const isBookmarked = !!S.bookmarks[post.id];

  el.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a onclick="go('home')">${esc(t('home'))}</a><span class="sep">›</span>
      ${c ? `<a onclick="${c.id ? `go('category','${esc(c.id)}')` : ''}">${esc(c.name)}</a><span class="sep">›</span>` : ''}
      <span class="muted">${esc(String(post.title||'').slice(0, 40))}...</span>
    </nav>
    <article itemscope itemtype="https://schema.org/NewsArticle">
      <header class="post-head">
        ${c ? `<div class="cat-pill" onclick="${c.id ? `go('category','${esc(c.id)}')` : ''}">${esc(c.name)}</div>` : ''}
        <h1 itemprop="headline">${esc(post.title||'')}</h1>
        ${post.subtitle ? `<p class="subtitle">${esc(post.subtitle)}</p>` : ''}
        <div class="post-meta">
          <div class="avatar" aria-hidden="true">${esc(authorInitial)}</div>
          <div>
            <b itemprop="author">${esc(author)}</b>
            <div style="font-size:12px;color:var(--gray-l);margin-top:2px">
              ${post.publishedAt ? `<time itemprop="datePublished" datetime="${fmtISO(post.publishedAt)}">প্রকাশ: ${esc(fmtDate(post.publishedAt))}</time>` : ''}
              ${post.updatedAt ? ` • <time itemprop="dateModified" datetime="${fmtISO(post.updatedAt)}">আপডেট: ${esc(relTime(post.updatedAt))}</time>` : ''}
            </div>
          </div>
          <span style="margin-left:auto;font-size:12.5px">👁 ${viewCount} ${t('views')} • ${readingTime(post.body)} ${t('minRead')}</span>
        </div>
      </header>

      <div class="ad-slot" data-ad-slot="post-top"></div>

      <!-- Adsterra Banner 300x250 — Post Top -->
      <div style="margin:20px auto;text-align:center;min-height:250px;max-width:300px">
        <script type="text/javascript">
          atOptions = {
            'key' : 'd234ca40ac54e37eb060d1e6ff10b53e',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highrevenueformat.com/d234ca40ac54e37eb060d1e6ff10b53e/invoke.js"></script>
      </div>

      ${post.image ? `<figure class="post-cover"><img src="${esc(post.image)}" alt="${esc(post.title||'')}" itemprop="image" fetchpriority="high" loading="eager"></figure>` : ''}
      <div class="post-tools">
        <button class="tool ${isBookmarked?'on':''}" onclick="toggleBookmark('${esc(post.id)}')" id="bmBtn">
          <span>${isBookmarked ? '🔖' : '📑'}</span><span>${isBookmarked ? t('bookmarked') : t('bookmark')}</span>
        </button>
        <button class="tool" onclick="sharePost('fb','${esc(post.id)}')" aria-label="Facebook">f</button>
        <button class="tool" onclick="sharePost('wa','${esc(post.id)}')" aria-label="WhatsApp">💬</button>
        <button class="tool" onclick="copyPostLink('${esc(post.id)}')">🔗 ${t('copyLink')}</button>
        <div class="font-group">
          <button onclick="setFontSize(${S.fontSize - 1})" title="ছোট">A-</button>
          <button onclick="setFontSize(${S.fontSize + 1})" title="বড়">A+</button>
        </div>
      </div>
      <div class="post-body fs-${S.fontSize}" id="postBody" itemprop="articleBody">${post.body || ''}</div>
      ${post.video ? renderVideoEmbed(post.video) : ''}

      <div class="ad-slot" data-ad-slot="post-bottom"></div>

      <!-- Adsterra Banner 320x50 — Post Bottom -->
      <div style="margin:20px auto;text-align:center;min-height:50px">
        <script type="text/javascript">
          atOptions = {
            'key' : '3edab59f9435194762c4b23783be4b9d',
            'format' : 'iframe',
            'height' : 50,
            'width' : 320,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highrevenueformat.com/3edab59f9435194762c4b23783be4b9d/invoke.js"></script>
      </div>

      ${tags.length ? `<div class="post-tags">${tags.map(tag => `<span class="post-tag" data-tag="${esc(tag)}" onclick="searchTag(this.dataset.tag)">#${esc(tag)}</span>`).join('')}</div>` : ''}
      <div class="post-share">
        <span>${t('share')}:</span>
        <button class="share-btn sb-fb" onclick="sharePost('fb','${esc(post.id)}')" title="Facebook" aria-label="Facebook">f</button>
        <button class="share-btn sb-tw" onclick="sharePost('tw','${esc(post.id)}')" title="Twitter" aria-label="Twitter">𝕏</button>
        <button class="share-btn sb-wa" onclick="sharePost('wa','${esc(post.id)}')" title="WhatsApp" aria-label="WhatsApp">💬</button>
        <button class="share-btn sb-tg" onclick="sharePost('tg','${esc(post.id)}')" title="Telegram" aria-label="Telegram">✈</button>
        <button class="share-btn sb-msg" onclick="sharePost('msg','${esc(post.id)}')" title="Messenger" aria-label="Messenger">m</button>
        <button class="share-btn sb-cp" onclick="copyPostLink('${esc(post.id)}')" title="Copy" aria-label="Copy">🔗</button>
      </div>
      ${(prevPost || nextPost) ? `
        <div class="post-nav">
          ${prevPost ? `<a onclick="go('post','${esc(prevPost.id)}')"><div class="dir">← পূর্ববর্তী</div><h4>${esc(prevPost.title||'')}</h4></a>` : '<span></span>'}
          ${nextPost ? `<a onclick="go('post','${esc(nextPost.id)}')" style="text-align:right"><div class="dir">পরবর্তী →</div><h4>${esc(nextPost.title||'')}</h4></a>` : '<span></span>'}
        </div>` : ''}
    </article>
    ${related.length ? `<div class="section" style="margin-top:44px"><div class="sec-head"><h2>${t('related')}</h2></div><div class="grid">${related.map(pcardHTML).join('')}</div></div>` : ''}
  `;

  rehydrateScripts(el);
  setTimeout(renderAds, 80);
}

function rehydrateScripts(container){
  if(!container) return;
  const scripts = container.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value);
    });
    if(oldScript.src){
      newScript.src = oldScript.src;
      newScript.async = true;
    } else {
      newScript.textContent = oldScript.textContent;
    }
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

function renderVideoEmbed(url){
  if(!url || !/^https?:\/\//i.test(url)) return '';
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if(m) return `<div style="aspect-ratio:16/9;margin:24px 0;border-radius:var(--r);overflow:hidden;background:#000"><iframe src="https://www.youtube.com/embed/${esc(m[1])}" title="Video" style="width:100%;height:100%;border:0" allow="accelerometer;autoplay;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  m = url.match(/vimeo\.com\/(\d+)/i);
  if(m) return `<div style="aspect-ratio:16/9;margin:24px 0;border-radius:var(--r);overflow:hidden;background:#000"><iframe src="https://player.vimeo.com/video/${esc(m[1])}" title="Video" style="width:100%;height:100%;border:0" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  if(/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return `<video controls preload="metadata" style="width:100%;border-radius:var(--r);margin:24px 0"><source src="${esc(url)}"></video>`;
  return `<p style="margin:20px 0"><a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--pri);font-weight:700">🎬 ভিডিও দেখুন →</a></p>`;
}

function incrementViews(pid){
  if(!pid) return;
  const key = 'np_viewed_' + pid;
  try {
    if(sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch(e){ return; }
  const statsRef = ref(db, 'postStats/' + pid + '/views');
  runTransaction(statsRef, cur => (Number(cur) || 0) + 1).catch(()=>{});
}

window.setFontSize = function(size){
  S.fontSize = Math.max(1, Math.min(4, size));
  try { localStorage.setItem('np_fs', String(S.fontSize)); } catch(e){}
  const body = $('#postBody');
  if(body){
    body.classList.remove('fs-1','fs-2','fs-3','fs-4');
    body.classList.add('fs-' + S.fontSize);
  }
};
(function initFontSize(){
  let fs = 2;
  try { fs = parseInt(localStorage.getItem('np_fs') || '2', 10) || 2; } catch(e){}
  S.fontSize = Math.max(1, Math.min(4, fs));
})();

/* ================================================================
   CATEGORY
   ================================================================ */
function renderCategory(catId, reset){
  if(reset) S.catLimit = 9;
  const c = S.categories.find(x => x.id === catId);

  seoCategory(c);

  const bEl = $('#catBreadcrumb');
  if(bEl) bEl.innerHTML = `<a onclick="go('home')">${esc(t('home'))}</a><span class="sep">›</span><span class="muted">${esc(c ? c.name : 'ক্যাটাগরি')}</span>`;
  const titleEl = $('#catTitle');
  if(titleEl) titleEl.innerHTML = c ? `${esc(c.icon||'📁')} ${esc(c.name)}` : 'ক্যাটাগরি';

  const all = S.posts.filter(p => postInCategory(p, catId, c ? c.name : null));
  const list = all.slice(0, S.catLimit);
  const grid = $('#catPostsGrid');
  if(grid) grid.innerHTML = S.ready.posts
    ? gridHTML(list, c ? `"${c.name}"-এ এখনো পোস্ট নেই` : 'এই ক্যাটাগরিতে পোস্ট নেই')
    : Array(6).fill(0).map(() => `<div class="skel" style="height:300px"></div>`).join('');
  const btn = $('#loadMoreCatBtn');
  if(btn) btn.style.display = (all.length > S.catLimit) ? '' : 'none';

  setTimeout(renderAds, 60);
}

/* ================================================================
   SEARCH
   ================================================================ */
function doSearch(q){
  S.searchQ = String(q||'').trim().toLowerCase();
  const grid = $('#searchGrid');
  const title = $('#searchTitle');
  if(title) title.innerHTML = S.searchQ ? `🔍 "${esc(q)}" — ফলাফল` : '🔍 সার্চ';
  if(!grid) return;
  if(!S.searchQ){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="ei">🔍</div><h4>কিছু লিখুন</h4><p>টাইটেল, কনটেন্ট বা ট্যাগ দিয়ে সার্চ করুন।</p></div>`;
    return;
  }
  const results = S.posts.filter(p => {
    const hay = [p.title, p.subtitle, p.excerpt, p.body, p.category, p.author,
      Array.isArray(p.tags) ? p.tags.join(' ') : p.tags].join(' ').toLowerCase();
    return hay.includes(S.searchQ);
  });
  grid.innerHTML = results.length
    ? gridHTML(results)
    : `<div class="empty" style="grid-column:1/-1"><div class="ei">😕</div><h4>${esc(t('noResults'))}</h4><p>"${esc(q)}" এর সাথে মিলে এমন কোনো পোস্ট নেই।</p></div>`;
  setTimeout(renderAds, 60);
}
function renderSearch(){
  const inp = $('#searchInput');
  if(inp && !inp.value) inp.value = S.searchQ || '';
  doSearch(S.searchQ || '');
  seoSearch(S.searchQ || '');
}
window.doSearchFromHeader = function(){
  S.searchQ = ($('#searchInput')?.value || '').trim();
  go('search');
};
window.searchTag = function(tag){
  S.searchQ = tag;
  go('search');
};
let _st;
function bindSearch(){
  const inp = $('#searchInput');
  if(!inp) return;
  inp.addEventListener('input', e => {
    clearTimeout(_st);
    const v = e.target.value;
    _st = setTimeout(() => {
      if(S.view === 'search'){
        S.searchQ = v;
        doSearch(v);
        const newPath = '/search' + (v ? '?q=' + encodeURIComponent(v) : '');
        history.replaceState({ view: 'search' }, '', newPath);
      }
    }, 260);
  });
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') doSearchFromHeader(); });
}

/* ================================================================
   STATIC PAGE
   ================================================================ */
function renderPage(slug){
  const el = $('#pageContainer');
  if(!el) return;
  if(!slug){ go('home'); return; }

  let page = S.pages[slug];
  const defaults = {
    about:   { title:'আমাদের সম্পর্কে', body:'<p>আমরা একটি স্বাধীন অনলাইন সংবাদ ও কনটেন্ট প্ল্যাটফর্ম।</p>' },
    privacy: { title:'প্রাইভেসি পলিসি', body:'<p>আমরা আপনার ব্যক্তিগত তথ্যের গোপনীয়তা সম্মান করি।</p>' },
    terms:   { title:'শর্তাবলী', body:'<p>এই ওয়েবসাইট ব্যবহার করার আগে শর্তাবলী পড়ুন।</p>' }
  };
  if(!page && defaults[slug]) page = { ...defaults[slug], id: slug };

  if(!page){
    el.innerHTML = `<div class="empty" style="padding:80px 20px"><div class="ei">📄</div><h4>পেজ পাওয়া যায়নি</h4><button class="btn-load" style="margin-top:20px" onclick="go('home')">হোমে ফিরুন</button></div>`;
    setRobots(ROBOTS_NOINDEX);
    return;
  }
  seoPage(page);
  el.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><a onclick="go('home')">${esc(t('home'))}</a><span class="sep">›</span><span class="muted">${esc(page.title||slug)}</span></nav>
    <h1 style="font-family:var(--font-serif);font-size:32px;margin:0 0 20px">${esc(page.title||'')}</h1>
    <div class="post-body" style="font-family:var(--font-bn)">${page.body || ''}</div>
  `;
}

/* ================================================================
   CONTACT
   ================================================================ */
window.submitContact = async function(){
  const name    = ($('#ctName')?.value || '').trim();
  const email   = ($('#ctEmail')?.value || '').trim();
  const subject = ($('#ctSubject')?.value || '').trim();
  const message = ($('#ctMsg')?.value || '').trim();
  const btn     = $('#ctBtn');

  if(name.length < 2){ toast('নাম দিন', 'warn'); return; }
  if(!/^\S+@\S+\.\S+$/.test(email)){ toast('সঠিক ইমেইল দিন', 'warn'); return; }
  if(subject.length < 2){ toast('বিষয় লিখুন', 'warn'); return; }
  if(message.length < 10){ toast('বার্তা কমপক্ষে ১০ অক্ষর', 'warn'); return; }

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'পাঠানো হচ্ছে...';

  try {
    const newRef = push(ref(db, 'messages'));
    await set(newRef, { name, email, subject, message, status: 'unread', createdAt: Date.now() });
    toast('বার্তা পাঠানো হয়েছে ✓', 'ok');
    $('#ctName').value = ''; $('#ctEmail').value = '';
    $('#ctSubject').value = ''; $('#ctMsg').value = '';
  } catch(e){
    console.error(e);
    toast('পাঠানো ব্যর্থ: ' + (e.message||e), 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
};

/* ================================================================
   BOOKMARKS
   ================================================================ */
function loadBookmarks(){
  try {
    const raw = localStorage.getItem('np_bookmarks');
    S.bookmarks = raw ? JSON.parse(raw) : {};
    if(typeof S.bookmarks !== 'object' || S.bookmarks === null) S.bookmarks = {};
  } catch(e){ S.bookmarks = {}; }
}
function saveBookmarks(){
  try { localStorage.setItem('np_bookmarks', JSON.stringify(S.bookmarks)); } catch(e){}
}
window.toggleBookmark = function(pid){
  if(!pid) return;
  const on = !!S.bookmarks[pid];
  if(on) delete S.bookmarks[pid];
  else S.bookmarks[pid] = true;
  saveBookmarks();
  const btn = $('#bmBtn');
  if(btn){
    btn.classList.toggle('on', !on);
    btn.innerHTML = `<span>${!on ? '🔖' : '📑'}</span><span>${!on ? t('bookmarked') : t('bookmark')}</span>`;
  }
  toast(!on ? 'সংরক্ষণ করা হয়েছে ✓' : 'সংরক্ষণ সরানো হয়েছে', 'ok');
};

/* ================================================================
   SHARE
   ================================================================ */
window.sharePost = function(platform, pid){
  const post = S.posts.find(p => p.id === pid) || (S.currentPost && S.currentPost.id === pid ? S.currentPost : null);
  if(!post){ toast('পোস্ট পাওয়া যায়নি', 'err'); return; }
  const url = buildUrl('post', pid);
  const text = (post.title || '') + '\n\n' + (S.settings.siteName || '');
  const enc = encodeURIComponent;
  if(platform === 'fb')       openShareWin('https://www.facebook.com/sharer/sharer.php?u=' + enc(url) + '&quote=' + enc(text));
  else if(platform === 'tw')  openShareWin('https://twitter.com/intent/tweet?url=' + enc(url) + '&text=' + enc(text));
  else if(platform === 'wa')  openShareWin('https://wa.me/?text=' + enc(text + '\n\n' + url));
  else if(platform === 'tg')  openShareWin('https://t.me/share/url?url=' + enc(url) + '&text=' + enc(text));
  else if(platform === 'msg') openShareWin('https://www.facebook.com/dialog/send?link=' + enc(url) + '&app_id=291494419107518&redirect_uri=' + enc(url));
  else if(platform === 'cp')  copyPostLink(pid);
};
window.copyPostLink = function(pid){
  copyToClipboard(buildUrl('post', pid));
};
async function copyToClipboard(url){
  try {
    if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
    else {
      const ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('লিংক কপি হয়েছে ✓', 'ok');
  } catch(e){ prompt('লিংক:', url); }
}
function openShareWin(url){
  const w = 600, h = 500;
  const y = (window.outerHeight - h)/2 + (window.screenY || 0);
  const x = (window.outerWidth - w)/2 + (window.screenX || 0);
  window.open(url, 'share', `width=${w},height=${h},left=${x},top=${y},noopener,noreferrer`);
}

/* ================================================================
   AUTH + BOOT
   ================================================================ */
onAuthStateChanged(auth, user => {
  S.user = user || null;
  window.__uid = user ? user.uid : null;
});

(function migrateOldHashUrls(){
  const h = location.hash;
  if(!h || h === '#' || h === '#home'){
    if(h) history.replaceState(null, '', '/');
    return;
  }
  const clean = h.replace(/^#/, '');
  const [view, id] = clean.split('/').filter(Boolean);
  if(['post','category','page','posts','contact','search'].includes(view)){
    let newPath;
    if(view === 'search'){
      newPath = '/search';
    } else if(id){
      newPath = '/' + view + '/' + encodeURIComponent(id);
    } else {
      newPath = '/' + view;
    }
    history.replaceState(null, '', newPath);
  }
})();

(function boot(){
  loadBookmarks();
  listenSettings();
  listenCategories();
  listenPosts();
  listenPages();
  listenAds();
  bindSearch();
  renderFooterPages();

  route();
  console.log('[Janala SEO] ready ✓ — v2.3 Adsterra integrated');
})();

window.esc = esc;