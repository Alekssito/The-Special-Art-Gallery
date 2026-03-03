const routePaths = {
  home: { pretty: '/', html: '/' },
  draw: { pretty: '/draw', html: '/draw.html' },
  login: { pretty: '/login', html: '/login.html' },
  register: { pretty: '/register', html: '/register.html' },
  profile: { pretty: '/profile', html: '/profile.html' }
};

function normalizePath(pathname) {
  if (!pathname) return '/';
  const lowerPathname = pathname.toLowerCase();
  if (lowerPathname.length > 1 && lowerPathname.endsWith('/')) {
    return lowerPathname.slice(0, -1);
  }
  return lowerPathname;
}

function supportsPrettyUrlsInCurrentContext() {
  if (typeof window === 'undefined') return false;

  const pathname = normalizePath(window.location.pathname);
  if (pathname !== '/' && !pathname.endsWith('.html')) {
    return true;
  }

  const knownPrettyLinks = Array.from(document.querySelectorAll('a[href]')).some((link) => {
    const href = link.getAttribute('href') || '';
    return /^\/(draw|login|register|profile)(\?|$)/i.test(href);
  });

  return knownPrettyLinks;
}

function toQueryString(query) {
  if (!query || typeof query !== 'object') return '';

  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const encoded = searchParams.toString();
  return encoded ? `?${encoded}` : '';
}

export function getRouteUrl(routeName, options = {}) {
  const route = routePaths[routeName];
  if (!route) {
    throw new Error(`Unknown route: ${routeName}`);
  }

  const { query } = options;
  const usePrettyUrls = supportsPrettyUrlsInCurrentContext();
  const basePath = usePrettyUrls ? route.pretty : route.html;

  return `${basePath}${toQueryString(query)}`;
}

export function navigateTo(routeName, options = {}) {
  if (typeof window === 'undefined') return;

  const { replace = false } = options;
  const targetUrl = getRouteUrl(routeName, options);

  if (replace) {
    window.location.replace(targetUrl);
    return;
  }

  window.location.assign(targetUrl);
}
