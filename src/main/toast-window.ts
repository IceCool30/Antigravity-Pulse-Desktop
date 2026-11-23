import { BrowserWindow, screen } from 'electron'

/**
 * Native-view workspaces are composited above the shell's DOM, so a DOM toast
 * would be invisible while a web workspace is active. This tiny, non-focusable
 * overlay window only appears in that case; the renderer's own toast stack is
 * used when Home / Cloud Sync / an overlay owns the stage.
 */

interface ToastContent {
  title: string
  body?: string
  kind?: 'info' | 'success' | 'error'
}

let toastWindow: BrowserWindow | null = null
let hideTimer: NodeJS.Timeout | null = null

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function ensureWindow(): BrowserWindow {
  if (toastWindow && !toastWindow.isDestroyed()) return toastWindow
  toastWindow = new BrowserWindow({
    width: 360,
    height: 96,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })
  toastWindow.setIgnoreMouseEvents(true)
  toastWindow.on('closed', () => {
    toastWindow = null
  })
  return toastWindow
}

function markups({ title, body, kind = 'info' }: ToastContent): { html: string; height: number } {
  const color = kind === 'success' ? '#10B981' : kind === 'error' ? '#EF4444' : '#FFC799'
  const detail = body ? `<p class="body">${escapeHtml(body.slice(0, 240))}</p>` : ''
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #fff;
    padding: 8px; animation: enter .18s cubic-bezier(.22,1,.36,1); }
  @keyframes enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { body { animation: none; } }
  .card { display: flex; gap: 11px; align-items: flex-start; padding: 13px 14px;
    background: linear-gradient(180deg, rgba(22,22,24,.97), rgba(8,8,9,.97));
    border: 1px solid rgba(255,255,255,.16); border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08); }
  .dot { width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; flex: none;
    background: ${color}; box-shadow: 0 0 14px ${color}99; }
  .title { font-size: 13px; font-weight: 600; letter-spacing: -.01em; line-height: 1.35; }
  .body { margin: 4px 0 0; font-size: 11.5px; line-height: 1.45; color: rgba(255,255,255,.7);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style></head><body><div class="card"><span class="dot"></span><div>
<div class="title">${escapeHtml(title.slice(0, 120))}</div>${detail}
</div></div></body></html>`
  return { html, height: body ? 112 : 84 }
}

export function showNativeToast(content: ToastContent): void {
  const window = ensureWindow()
  if (window.isDestroyed()) return
  const { html, height } = markups(content)
  const parent = BrowserWindow.getAllWindows().find(
    (candidate) => !candidate.isDestroyed() && candidate.isVisible() && candidate !== window
  )
  const display = parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay()
  const area = display.workArea
  window.setBounds({
    x: area.x + area.width - 376,
    y: area.y + area.height - height - 20,
    width: 360,
    height
  })
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => undefined)
  window.showInactive()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hideTimer = null
    if (!window.isDestroyed()) window.hide()
  }, 4200)
}

export function destroyNativeToast(): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = null
  if (toastWindow && !toastWindow.isDestroyed()) toastWindow.close()
  toastWindow = null
}
