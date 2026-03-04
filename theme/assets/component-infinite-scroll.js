document.addEventListener('DOMContentLoaded', () => {
  const sentinel = document.querySelector('[id^="infinite-scroll-sentinel-"]');
  if (!sentinel) return;

  const grid = document.getElementById('main-collection-product-grid');
  if (!grid) return;

  let currentPage = parseInt(grid.dataset.currentPage || '1', 10);
  const totalPages = parseInt(grid.dataset.totalPages || '1', 10);
  const collectionUrl = grid.dataset.collectionUrl || window.location.pathname;

  const itemsPerLoad = parseInt(grid.dataset.itemsPerLoad || '12', 10);

  let loading = false;

  const fetchNext = async () => {
    if (loading) return;
    if (currentPage >= totalPages) return;
    loading = true;
    const nextPage = currentPage + 1;

    // construct URL: preserve search params, just add page
    const url = new URL(collectionUrl, window.location.origin);
    url.searchParams.set('page', nextPage);

    try {
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Network error');
      const text = await res.text();

      // Parse returned HTML and extract product items — assume server renders same product grid markup
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      // Look for product grid children (product items). Fallback selectors used by this theme:
      let newItems = Array.from(doc.querySelectorAll('.box__collection, .product-holder, .site-box.box__collection'));
      if (newItems.length === 0) {
        // try finding grid container and its children
        const remoteGrid = doc.getElementById('main-collection-product-grid');
        if (remoteGrid) {
          newItems = Array.from(remoteGrid.querySelectorAll('.box__collection'));
        }
      }

      // Determine append container inside local grid
      const appendContainer =
        grid.querySelector('.product-grid-border-fix') ||
        grid.querySelector('.product-grid-border-fix.fix-bottom-border') ||
        grid;

      // Build set of already-present product links across the whole grid to avoid duplicates
      const existingLinks = new Set();
      grid.querySelectorAll('.product-item__special-link, a.product-item__special-link').forEach((a) => {
        try {
          existingLinks.add(new URL(a.href, window.location.origin).pathname);
        } catch (e) {}
      });

      // Append up to itemsPerLoad nodes, skipping duplicates (by product href)
      let appended = 0;
      newItems.forEach((node) => {
        if (appended >= itemsPerLoad) return;
        const link = node.querySelector('.product-item__special-link, a.product-item__special-link');
        let hrefPath = null;
        if (link && link.getAttribute) {
          try {
            hrefPath = new URL(link.getAttribute('href'), window.location.origin).pathname;
          } catch (e) {
            hrefPath = null;
          }
        }
        if (hrefPath && existingLinks.has(hrefPath)) {
          // already present, skip
          return;
        }
        const clone = node.cloneNode(true);
        appendContainer.appendChild(clone);
        appended += 1;
        if (hrefPath) existingLinks.add(hrefPath);
      });

      currentPage = nextPage;

      // update grid metadata
      grid.dataset.currentPage = currentPage;

      // no client-side URL change: server-side redirects are recommended for canonical URLs

      if (currentPage >= totalPages) {
        // all loaded: remove sentinel and optionally pagination
        sentinel.remove();
      }
    } catch (err) {
      console.error('Infinite scroll failed', err);
    } finally {
      loading = false;
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          fetchNext();
        }
      }
    },
    { rootMargin: '400px' }
  );

  observer.observe(sentinel);
});
