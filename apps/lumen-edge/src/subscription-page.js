export const SUBSCRIPTION_PAGE_MODEL_VERSION = "lumen.edge.subscription-page.v1";

const CLIENTS = Object.freeze([
  {
    key: "hiddify",
    label: "Hiddify",
    platform: "Android, iOS, Windows, macOS, Linux",
    renderer: "Raw URI subscription",
    scheme: "hiddify"
  },
  {
    key: "happ",
    label: "Happ",
    platform: "Android, iOS, Windows, macOS",
    renderer: "Raw URI subscription",
    scheme: "happ"
  },
  {
    key: "v2ray",
    label: "v2rayNG / v2rayN",
    platform: "Android, Windows",
    renderer: "Raw URI subscription",
    scheme: "v2rayng"
  },
  {
    key: "v2ray-base64",
    label: "v2ray base64",
    platform: "Legacy v2ray clients",
    renderer: "Base64 URI subscription",
    scheme: null
  },
  {
    key: "streisand",
    label: "Streisand",
    platform: "iOS, macOS",
    renderer: "Raw URI subscription",
    scheme: null
  },
  {
    key: "shadowrocket",
    label: "Shadowrocket",
    platform: "iOS",
    renderer: "Raw URI subscription",
    scheme: null
  },
  {
    key: "mihomo",
    label: "Mihomo / Clash Meta",
    platform: "Desktop, Android",
    renderer: "YAML proxy groups",
    scheme: null
  },
  {
    key: "flclash",
    label: "FlClash",
    platform: "Android, Windows, macOS, Linux",
    renderer: "YAML proxy groups",
    scheme: null
  },
  {
    key: "stash",
    label: "Stash",
    platform: "iOS, macOS",
    renderer: "YAML proxy groups",
    scheme: null
  },
  {
    key: "koala-clash",
    label: "Koala Clash",
    platform: "Android",
    renderer: "YAML proxy groups",
    scheme: null
  },
  {
    key: "sing-box",
    label: "Sing-box / NekoBox",
    platform: "Android, iOS, desktop",
    renderer: "sing-box JSON",
    scheme: null
  },
  {
    key: "nekoray",
    label: "NekoRay",
    platform: "Windows, Linux",
    renderer: "sing-box JSON",
    scheme: null
  },
  {
    key: "amnezia",
    label: "Amnezia / Xray JSON",
    platform: "Android, iOS, desktop",
    renderer: "Xray JSON",
    scheme: null
  }
]);

export function wantsHtmlSubscriptionPage(request) {
  const accept = String(request.headers.accept ?? "");
  const userAgent = String(request.headers["user-agent"] ?? "").toLowerCase();
  return accept.includes("text/html") && !/(hiddify|happ|clash|mihomo|sing-box|v2ray|nekobox|stash)/.test(userAgent);
}

export function renderDeviceBindingHtml({ publicId, publicUrl }) {
  const safePublicId = String(publicId ?? "");
  const safePublicUrl = String(publicUrl ?? "");
  const storageKey = `lumen-sub-device:${safePublicId}`;
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lumen subscription device binding</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #10151d; color: #f7fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 30% 0%, #1b2441 0, #101720 42%, #0c1118 100%); }
    body::before { content: ""; position: fixed; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 64px 64px; pointer-events: none; }
    main { position: relative; width: min(520px, calc(100% - 28px)); border: 1px solid #293341; background: rgba(19,25,35,.9); border-radius: 16px; padding: 28px; box-shadow: 0 18px 60px rgba(0,0,0,.24); }
    .mark { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg,#35e4ff,#1468ff); margin-bottom: 18px; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0; color: #a7b2c2; line-height: 1.55; }
    a { color: #54e7ff; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true"></div>
    <h1>Готовим привязку устройства</h1>
    <p>Сейчас страница подписки откроется заново с постоянным идентификатором этого браузера. Это нужно для лимита устройств и HWID-политики.</p>
    <p><a href="${escapeHtml(safePublicUrl)}">Продолжить вручную</a></p>
  </main>
  <script>
    (() => {
      const storageKey = ${JSON.stringify(storageKey)};
      const generateId = () => {
        if (globalThis.crypto?.randomUUID) {
          return "web-" + globalThis.crypto.randomUUID();
        }
        const random = Math.random().toString(36).slice(2);
        return "web-" + Date.now().toString(36) + "-" + random;
      };
      let deviceId = "";
      try {
        deviceId = localStorage.getItem(storageKey) || "";
        if (!deviceId) {
          deviceId = generateId();
          localStorage.setItem(storageKey, deviceId);
        }
      } catch {
        deviceId = generateId();
      }
      const url = new URL(globalThis.location.href);
      if (!url.searchParams.get("hwid") && !url.searchParams.get("device_id")) {
        url.searchParams.set("hwid", deviceId);
      }
      globalThis.location.replace(url.toString());
    })();
  </script>
</body>
</html>`;
}

export function renderSubscriptionPageHtml({ manifest, publicUrl }) {
  const provider = manifest.provider?.name || "Lumen";
  const subpage = normalizeSubpageConfig(manifest.metadata?.subpage);
  const title = subpage.title || manifest.metadata?.profileTitle || provider;
  const subscription = manifest.subscription ?? {};
  const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  const expiresText = expiresAt && !Number.isNaN(expiresAt.getTime())
    ? expiresAt.toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })
    : "без срока";
  const supportUrl = manifest.metadata?.supportUrl || "#";
  const supportText = subpage.supportText || "Support";
  const enabledCards = new Set(subpage.cards);
  const showStatus = enabledCards.size === 0 || enabledCards.has("status");
  const showApps = enabledCards.size === 0 || enabledCards.has("apps");
  const showLinks = enabledCards.size === 0 || enabledCards.has("links") || enabledCards.has("qr");
  const clientLinks = CLIENTS.map((client) => {
    const targetUrl = client.key === "happ" ? `${publicUrl}/${client.key}?raw=1` : `${publicUrl}/${client.key}`;
    const encodedTargetUrl = encodeURIComponent(targetUrl);
    let importUrl = targetUrl;
    let iosImportUrl = targetUrl;
    if (client.scheme === "hiddify") {
      importUrl = `hiddify://import/${targetUrl}#${encodeURIComponent(title)}`;
    }
    if (client.scheme === "happ") {
      importUrl = `happ://add/${encodedTargetUrl}`;
      iosImportUrl = `happ://import/${encodedTargetUrl}`;
    }
    if (client.scheme === "v2rayng") {
      importUrl = `v2rayng://install-sub?url=${encodedTargetUrl}#${encodeURIComponent(title)}`;
    }
    return { ...client, importUrl, iosImportUrl, targetUrl };
  });
  const happLink = clientLinks.find((client) => client.key === "happ");
  const rawSubscriptionUrl = happLink?.targetUrl ?? `${publicUrl}/v2ray`;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Subscription</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #10151d; color: #f7fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(180deg, #10151d 0%, #151a25 100%); }
    body::before { content: ""; position: fixed; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
    main { position: relative; width: min(900px, calc(100% - 32px)); margin: 0 auto; padding: 30px 0 54px; }
    header, section { border: 1px solid #2d3748; background: rgba(28, 34, 46, .88); border-radius: 16px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 22px 28px; }
    .brand { display: flex; gap: 12px; align-items: center; font-weight: 800; color: #56dff7; font-size: 22px; }
    .mark { width: 30px; height: 30px; border-left: 4px solid #22d3ee; border-right: 4px solid #22d3ee; border-radius: 7px; }
    .telegram { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid #1d9bf0; border-radius: 10px; color: #35d2ff; text-decoration: none; font-weight: 800; }
    .card { margin-top: 28px; padding: 28px 32px; }
    .status { display: grid; grid-template-columns: 54px 1fr; gap: 14px; align-items: center; }
    .check { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: rgba(16, 185, 129, .15); border: 1px solid #10b981; color: #69f0ae; font-size: 24px; }
    h1, h2, p { margin: 0; }
    h1 { font-size: clamp(24px, 4vw, 34px); }
    h2 { font-size: 20px; margin-bottom: 16px; }
    .muted { color: #a6b0c0; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
    .info { border: 1px solid #334155; border-radius: 10px; padding: 14px; background: rgba(15, 23, 42, .35); }
    .info span { display: block; color: #94a3b8; font-size: 13px; margin-bottom: 5px; }
    .apps { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    .app { border: 1px solid #334155; background: #1b2330; color: #edf2f7; border-radius: 10px; padding: 14px; text-decoration: none; display: grid; gap: 6px; min-height: 88px; }
    .app:hover { border-color: #22d3ee; color: #67e8f9; }
    .app span { color: #94a3b8; font-size: 12px; }
    .app em { color: #67e8f9; font-style: normal; font-size: 13px; }
    .copy { margin-top: 18px; display: grid; gap: 10px; }
    .import-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
    .import-action { border: 1px solid #334155; background: #111827; color: #edf2f7; border-radius: 10px; padding: 11px 14px; text-decoration: none; font-weight: 800; }
    .import-action.primary { border-color: #22d3ee; color: #67e8f9; }
    button.import-action { cursor: pointer; font: inherit; }
    code { display: block; word-break: break-all; color: #cbd5e1; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; }
    @media (max-width: 620px) { header { padding: 18px; } .card { padding: 22px 18px; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body class="${escapeHtml(subpage.theme ? `theme-${cssToken(subpage.theme)}` : "")}">
  <main>
    <header>
      <div class="brand"><span class="mark" aria-hidden="true"></span>${escapeHtml(provider)}</div>
      <a class="telegram" href="${escapeHtml(supportUrl)}" aria-label="${escapeHtml(supportText)}">↗</a>
    </header>
    ${showStatus ? `<section class="card" data-subpage-config-id="${escapeHtml(subpage.configId ?? "")}" data-subpage-config-name="${escapeHtml(subpage.configName ?? "")}">
      <div class="status">
        <div class="check">✓</div>
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p class="muted">Подписка активна · истекает: ${escapeHtml(expiresText)}</p>
        </div>
      </div>
      <div class="grid">
        <div class="info"><span>Профиль</span><strong>${escapeHtml(title)}</strong></div>
        <div class="info"><span>Статус</span><strong>Активна</strong></div>
        <div class="info"><span>Subscription ID</span><strong>${escapeHtml(subscription.id || "")}</strong></div>
        <div class="info"><span>Форматы</span><strong>URI · YAML · JSON</strong></div>
      </div>
    </section>` : ""}
    ${showApps ? `<section class="card">
      <h2>Добавить подписку</h2>
      ${happLink ? `<div class="import-actions" aria-label="Happ import actions">
        <a class="import-action primary" href="${escapeHtml(happLink.importUrl)}" data-client-link data-client="Happ">Open Happ</a>
        <a class="import-action" href="${escapeHtml(happLink.iosImportUrl)}" data-client-link data-client="Happ iOS">Open Happ iOS</a>
        <a class="import-action" href="${escapeHtml(happLink.targetUrl)}">Raw Happ</a>
        <button class="import-action" type="button" data-copy-url data-url="${escapeHtml(happLink.targetUrl)}">Copy Raw</button>
      </div>` : ""}
      <div class="apps">
        ${clientLinks.map((client) => `<a class="app" href="${escapeHtml(client.importUrl)}"><strong>${escapeHtml(client.label)}</strong><span>${escapeHtml(client.platform)}</span><em>${escapeHtml(client.renderer)}</em></a>`).join("")}
      </div>
    </section>` : ""}
    ${showLinks ? `<section class="card">
      <h2>Manual import URLs</h2>
      <div class="copy">
        <p class="muted">Для ручного импорта используйте универсальный URL или нужный URL формата:</p>
        <code>${escapeHtml(rawSubscriptionUrl)}</code>
        ${clientLinks.map((client) => `<code>${escapeHtml(client.targetUrl)}</code>`).join("")}
      </div>
    </section>` : ""}
  </main>
  <script>
    document.querySelectorAll("[data-copy-url]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.dataset.url || "";
        try {
          await navigator.clipboard.writeText(value);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Open Raw and copy";
        }
      });
    });
  </script>
</body>
</html>`;
}

function normalizeSubpageConfig(value) {
  const config = value && typeof value === "object" ? value : {};
  const cards = Array.isArray(config.cards)
    ? config.cards.filter((card) => typeof card === "string" && card.length > 0)
    : [];
  return {
    cards,
    configId: typeof config.configId === "string" ? config.configId : null,
    configName: typeof config.configName === "string" ? config.configName : null,
    supportText: typeof config.supportText === "string" ? config.supportText : null,
    theme: typeof config.theme === "string" ? config.theme : null,
    title: typeof config.title === "string" ? config.title : null
  };
}

function cssToken(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
