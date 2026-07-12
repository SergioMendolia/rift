import { watch } from "vue";
import { useFeedsStore } from "../stores/feeds";

const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1a1a"/>
  <path d="M160 160 Q352 160 352 352" stroke="#4d9fff" stroke-width="32" stroke-linecap="round" fill="none"/>
  <path d="M160 240 Q272 240 272 352" stroke="#4d9fff" stroke-width="32" stroke-linecap="round" fill="none"/>
  <circle cx="176" cy="336" r="32" fill="#4d9fff"/>
</svg>`;

function buildFaviconSvg(count: number): string {
  if (count <= 0) return FAVICON_SVG;
  const text = count > 99 ? "99+" : String(count);
  const fontSize = text.length > 2 ? 28 : text.length > 1 ? 34 : 40;
  const badgeR = text.length > 2 ? 64 : text.length > 1 ? 58 : 52;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1a1a"/>
  <path d="M160 160 Q352 160 352 352" stroke="#4d9fff" stroke-width="32" stroke-linecap="round" fill="none"/>
  <path d="M160 240 Q272 240 272 352" stroke="#4d9fff" stroke-width="32" stroke-linecap="round" fill="none"/>
  <circle cx="176" cy="336" r="32" fill="#4d9fff"/>
  <circle cx="384" cy="128" r="${badgeR}" fill="#e53935"/>
  <text x="384" y="128" font-size="${fontSize}" font-weight="bold" fill="white"
    text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">${text}</text>
</svg>`;
}

let currentFaviconHref: string | null = null;

function updateFavicon(count: number): void {
  const svg = buildFaviconSvg(count);
  const href = "data:image/svg+xml," + encodeURIComponent(svg);

  if (currentFaviconHref === href) return;
  currentFaviconHref = href;

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (link) {
    link.href = href;
  } else {
    const newLink = document.createElement("link");
    newLink.rel = "icon";
    newLink.type = "image/svg+xml";
    newLink.href = href;
    document.head.appendChild(newLink);
  }
}

function updateAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && nav.setAppBadge) {
      nav.setAppBadge(count).catch(() => {});
    } else if (count <= 0 && nav.clearAppBadge) {
      nav.clearAppBadge().catch(() => {});
    }
  } catch {}
}

export function useUnreadBadge(): () => void {
  const feeds = useFeedsStore();

  const stop = watch(
    () => feeds.totalUnread,
    (count) => {
      updateFavicon(count);
      updateAppBadge(count);
    },
    { immediate: true },
  );

  return stop;
}