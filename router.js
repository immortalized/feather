import { createRenderContext, render } from './core.js';

function normalizeComponent(component) {
  if (typeof component === 'function') {
    return {
      name: component.name || 'AnonymousPage',
      setup: null,
      render: () => '',
      mount: ({ container, route, router }) => component(container, { route, router }),
    };
  }

  return component;
}

function resolveRouterRoot(root) {
  if (typeof root === 'string') {
    return document.querySelector(root);
  }

  return root;
}

export function createRouter({
  root,
  routes,
  beforeResolve,
  afterRender,
  notFoundPath = '/login',
}) {
  const resolvedRoot = resolveRouterRoot(root);

  if (!resolvedRoot) {
    throw new Error(`Feather: Could not find router root "${String(root)}". Pass a DOM element or a valid selector.`);
  }

  let activeView = null;
  let activeContext = null;
  let activeRoute = null;

  function cleanupActiveRoute() {
    if (activeView?.destroy) {
      activeView.destroy();
    } else if (activeContext?.destroy) {
      activeContext.destroy();
    }

    activeView = null;
    activeContext = null;
    activeRoute = null;
  }

  function matchRoute(pathname) {
    return routes.find((route) => route.path === pathname)
      || routes.find((route) => route.path === notFoundPath)
      || routes[0]
      || null;
  }

  function forceScrollTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function normalizeNavigationPath(path) {
    if (!path) return '';

    try {
      const url = new URL(path, window.location.origin);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return String(path);
    }
  }

  function resolvePath(pathname) {
    let nextPath = pathname;

    while (typeof beforeResolve === 'function') {
      const redirectedPath = beforeResolve({ path: nextPath, route: matchRoute(nextPath), router });
      if (!redirectedPath || redirectedPath === nextPath) {
        break;
      }

      window.history.replaceState(null, '', redirectedPath);
      nextPath = redirectedPath;
    }

    return nextPath;
  }

  function renderCurrentRoute() {
    const path = resolvePath(window.location.pathname);
    const route = matchRoute(path);
    if (!route) return;

    cleanupActiveRoute();
    resolvedRoot.innerHTML = '';

    const outlet = document.createElement('div');
    outlet.className = 'feather-route-view';
    resolvedRoot.appendChild(outlet);

    const component = normalizeComponent(route.component);
    const context = createRenderContext({
      container: outlet,
      route,
      router,
    });
    const setupState = typeof component.setup === 'function'
      ? component.setup(context) || {}
      : {};

    Object.assign(context, setupState);

    activeContext = context;
    activeRoute = route;

    activeView = render(
      (renderContext) => component.render?.(renderContext),
      outlet,
      {
        context,
        mount(renderContext) {
          component.mount?.(renderContext);
        },
        afterRender(renderContext) {
          afterRender?.({
            path,
            route,
            router,
            root: resolvedRoot,
            outlet,
            context: renderContext,
          });
        },
      },
    );

    forceScrollTop();
    requestAnimationFrame(forceScrollTop);
  }

  const router = {
    get currentRoute() {
      return activeRoute;
    },
    navigate(path, { replace = false } = {}) {
      const nextPath = normalizeNavigationPath(path);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (!nextPath || nextPath === currentPath) {
        renderCurrentRoute();
        return;
      }

      if (replace) {
        window.history.replaceState(null, '', nextPath);
      } else {
        window.history.pushState(null, '', nextPath);
      }

      renderCurrentRoute();
    },
    start() {
      window.addEventListener('popstate', renderCurrentRoute);

      document.addEventListener('click', (event) => {
        const link = event.target.closest('[data-link]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('http')) return;

        event.preventDefault();
        router.navigate(href);
      });

      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', renderCurrentRoute, { once: true });
      } else {
        renderCurrentRoute();
      }
    },
  };

  return router;
}
