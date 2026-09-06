chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.storage.local.remove(['pm_restricted_until', 'pm_tamper_strikes', 'pm_access_gate']);
    const st = await chrome.storage.local.get(['gemini_api_key']);
    await chrome.storage.local.set({
      gemini_api_key: st.gemini_api_key || '',
      pm_is_pro: true,
      pm_system: 'a',
      pm_plan: 'pro-key',
      pm_plan_display: 'Silver (Own Key - Unlocked)',
      pm_daily_limit: 999999,
      pm_remaining: 999999,
      pm_total: 999999,
      pm_activated_email: 'unlocked@local.pro',
      pm_expires: '2099-12-31T23:59:59Z',
      pm_days_left: 99999
    });
  } catch (_) {}
});
// AI Vision Prompt — background.js (spec: cursor-prompt.md)
// System A: user's Groq / Gemini key · System B: Cloudflare Worker

// const WORKER_URL = 'http://127.0.0.1';
const WORKER_URL = 'http://127.0.0.1';

async function checkSubscriptionFromAdmin(email) {
  const res = await fetch(
    `${WORKER_URL}/subscription-status?email=${encodeURIComponent(email)}`
  );

  if (!res.ok) {
    throw new Error("Subscription check failed");
  }

  return await res.json();
}

/** Structured worker access denial for content-script modal (`PM_ERR:CODE` + newline + user message). */
function _workerAccessError(errorCode, userMessage) {
  const c = String(errorCode || 'ACCESS_DENIED').trim() || 'ACCESS_DENIED';
  const m = String(userMessage || '').trim() || 'Access denied.';
  return new Error('PM_ERR:' + c + '\n' + m);
}

async function _downgradeToFreeLocal() {
  return;
}

async function _resolveEffectiveHistoryMax() {
  return 1000;
}

function _computeHistoryMax(isPro, plan, system) {
  return 1000;
}

async function _midnightResetHistoryIfNeeded() {
  return false;
}

async function _trimHistoryToEffectiveCap() {
  const max = await _resolveEffectiveHistoryMax();
  const { prompt_history } = await chrome.storage.local.get('prompt_history');
  if (!Array.isArray(prompt_history) || prompt_history.length <= max) return;
  await chrome.storage.local.set({
    prompt_history: prompt_history.slice(-max)
  });
}

async function _appendPromptHistoryBg(promptText, detectedStyle) {
  const p = String(promptText || '')
    .replace(/^\/imagine\s*/i, '')
    .trim();
  if (!p) return { ok: false, count: 0, error: 'empty' };
  const max = await _resolveEffectiveHistoryMax();
  const o = await chrome.storage.local.get(['prompt_history', 'prompt_style']);
  const style = o.prompt_style || 'universal';
  let hist = Array.isArray(o.prompt_history) ? [...o.prompt_history] : [];
  hist.push({
    prompt: p,
    style,
    detectedStyle: detectedStyle || null,
    ts: Date.now()
  });
  while (hist.length > max) hist.shift();
  try {
    await chrome.storage.local.set({ prompt_history: hist });
  } catch (e) {
    return { ok: false, count: 0, error: (e && e.message) || 'storage_write_failed' };
  }
  return { ok: true, count: hist.length, max };
}

/** After a successful generation (same moment quota updates). Retries if storage is busy. */
async function _persistGenerateHistory(promptText, detectedStyle) {
  const p = String(promptText || '')
    .replace(/^\/imagine\s*/i, '')
    .trim();
  if (!p) return;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await _appendPromptHistoryBg(p, detectedStyle);
      if (r && r.ok) return;
      console.warn('[VisionPrompt] history append returned non-ok', attempt, r);
    } catch (e) {
      console.warn('[VisionPrompt] history append threw', attempt, e);
    }
    await new Promise((res) => setTimeout(res, 180 * attempt));
  }
  console.warn('[VisionPrompt] history append failed after retries');
}

/** Short output instructions for own-key calls only (worker owns full SYSTEM_PROMPT). */
const STYLE_INSTRUCTIONS = {
  universal:
    `Analyze this image meticulously and output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[A photorealistic detailed description capturing the subjects, clothing, poses, facial expression, background, dominant colors, composition, and exact text/typography with "replicate the exact typography style"]

NEGATIVE:
blurry, deformed, ugly, low quality, watermark, text obscured, chaotic

IMAGE DETAILS:
[Shot type, framing, depth of field, bokeh, lighting type, dominant colors, and aspect ratio]`,

  cinematic:
    `Analyze this image meticulously and craft an ultra-detailed 35mm film cinematic prompt. Output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[Cinematic 35mm still, captured on Leica M11 with Summilux 35mm f/1.4 lens, natural organic film grain, photorealistic rendering detailing subject appearance, wardrobe textures, authentic skin imperfections, cinematic volumetric lighting, atmospheric haze, color graded with Kodak Portra 400 tones, with "replicate the exact typography style"]

NEGATIVE:
blurry, digital rendering, flat lighting, oversaturated, deformed, bad anatomy, watermark, signature

IMAGE DETAILS:
[Camera: Leica M11 35mm, Framing: Cinematic wide/medium, Lighting: Volumetric atmospheric, Palette: Rich Kodak tones, Aspect Ratio: --ar 21:9]`,

  pixar3d:
    `Analyze this image and transform it into a whimsical 3D Disney/Pixar animated film scene. Output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[A stunning 3D computer animated movie still in modern Pixar and Disney animation studio style, expressive stylized character design, warm subsurface scattering on skin, rich tactile clothing fabrics, soft magical global illumination, vibrant joyful color palette, rendered with Octane Render and Unreal Engine 5, with "replicate the exact typography style"]

NEGATIVE:
photorealistic, gritty, eerie, grotesque, dark, bad geometry, low poly, noisy, watermark

IMAGE DETAILS:
[Style: 3D Pixar Animation, Lighting: Warm key light with soft rim fill, Engine: Octane 3D Render, Colors: Saturated vibrant storybook tones]`,

  anime:
    `Analyze this image and transform it into a masterpiece Japanese Anime illustration. Output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[Breathtaking Japanese anime visual, Makoto Shinkai and Studio Ghibli aesthetic, intricate hand-drawn line art, expressive eyes, dramatic sky with sunbeams and painted cumulonimbus clouds, lush scenic background, emotive atmospheric lighting, cinematic anime keyframe illustration, with "replicate the exact typography style"]

NEGATIVE:
photorealistic, 3D CGI, bad sketch, western comic, dull colors, low resolution, watermark

IMAGE DETAILS:
[Style: Japanese Anime Keyframe, Art Direction: Studio Ghibli / Makoto Shinkai, Palette: Sky blues, emerald greens, warm sunset glow]`,

  fluxraw:
    `Analyze this image and craft an authentic unedited raw DSLR camera prompt. Output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[Unedited raw candid photograph, Hasselblad H6D-100c medium format camera, authentic skin textures, natural skin pores, un-retouched facial features, candid posture, realistic ambient lighting, genuine depth of field, documentary photography style, with "replicate the exact typography style"]

NEGATIVE:
airbrushed, AI plastic skin, Photoshop smooth, overprocessed, fake, CGI, render, watermark

IMAGE DETAILS:
[Camera: Hasselblad Medium Format Raw, Lighting: True ambient daylight, Depth: True f/2.8 optical bokeh, Detail: Extreme pore-level clarity]`,

  cyberpunk:
    `Analyze this image and transform it into a neon futuristic cyberpunk scene. Output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[Dystopian high-tech cyberpunk aesthetic, drenched in neon cyan and magenta illumination, wet reflective asphalt surfaces with rain puddles, cybernetic augmentations, holographic street signage, dense futuristic megacity background, high-contrast chiaroscuro lighting, with "replicate the exact typography style"]

NEGATIVE:
daylight, pastel, countryside, vintage retro, low contrast, washed out, blurry

IMAGE DETAILS:
[Style: Cyberpunk Sci-Fi, Lighting: High-contrast neon glow and wet reflections, Mood: Moody futuristic noir]`,

  midjourney:
    `Analyze this image meticulously and output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[A photorealistic detailed description capturing the subjects, clothing, poses, facial expression, background, dominant colors, composition, and exact text/typography with "replicate the exact typography style". End with Midjourney parameters like --ar 16:9 --v 6.1 --stylize 250]

NEGATIVE:
blurry, deformed, ugly, low quality, watermark, text obscured, chaotic

IMAGE DETAILS:
[Shot type, framing, depth of field, bokeh, lighting type]`,

  stablediff:
    `Analyze this image meticulously and output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[((masterpiece, best quality, ultra-detailed)), detailed description capturing the subjects, clothing, poses, background, lighting, and exact text/typography with "replicate the exact typography style"]

NEGATIVE:
blurry, deformed, ugly, low quality, watermark, text obscured, chaotic, bad anatomy, bad hands, extra limbs

IMAGE DETAILS:
[Shot type, framing, depth of field, bokeh, lighting type]`,

  dalle:
    `Analyze this image meticulously and output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[A rich, highly detailed descriptive natural language paragraph capturing the scene, subjects, clothing, background, colors, mood, and exact typography for DALL-E 3]

NEGATIVE:
blurry, deformed, ugly, low quality, watermark, text obscured, chaotic

IMAGE DETAILS:
[Shot type, framing, depth of field, bokeh, lighting type]`,

  flux:
    `Analyze this image meticulously and output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[A clean, highly descriptive natural language paragraph capturing tactile textures, subjects, clothing, background, colors, mood, and exact typography optimized for Flux]

NEGATIVE:
blurry, deformed, ugly, low quality, watermark, text obscured, chaotic

IMAGE DETAILS:
[Shot type, framing, depth of field, bokeh, lighting type]`,

  auto:
    `Analyze this image meticulously and output EXACTLY in the following 3-section format with no markdown asterisks or bolding:

MAIN PROMPT:
[A photorealistic detailed description capturing the subjects, clothing, poses, facial expression, background, dominant colors, composition, and exact text/typography with "replicate the exact typography style"]

NEGATIVE:
blurry, deformed, ugly, low quality, watermark, text obscured, chaotic

IMAGE DETAILS:
[Shot type, framing, depth of field, bokeh, lighting type]`
};

let _planConfigCache = null;
let _planConfigFetchedAt = 0;
const PLAN_CONFIG_TTL = 5 * 60 * 1000;

function _fallbackPlanLimits() {
  return {
    free: 10,
    systemA: { basic: 100, standard: 500, 'pro-key': 1000, proKey: 1000 },
    systemB: { starter: 100, pro: 150, power: 300, max: 500 }
  };
}

function _fallbackPlanFeatures() {
  /* Product matrix: bulk + CSV on Master Vault (System A pro-key) and Ultimate Nexus (max). Device counts match site comparison. */
  return {
    free: { bulkGenerate: false, maxDevices: 1, csvExport: false },
    systemA: {
      basic: { bulkGenerate: false, maxDevices: 2, csvExport: false },
      standard: { bulkGenerate: false, maxDevices: 3, csvExport: false },
      'pro-key': { bulkGenerate: true, maxDevices: 999, csvExport: true },
      proKey: { bulkGenerate: true, maxDevices: 999, csvExport: true }
    },
    systemB: {
      starter: { bulkGenerate: false, maxDevices: 1, csvExport: false },
      pro: { bulkGenerate: false, maxDevices: 2, csvExport: false },
      power: { bulkGenerate: true, maxDevices: 999, csvExport: true },
      max: { bulkGenerate: true, maxDevices: 999, csvExport: true }
    }
  };
}

/**
 * Mirrors worker `_finalizeSystemBPlanFeatures` + System A Master Vault rules + Starter Core device cap.
 * Pricing KV is the source of truth; this only enforces tier rules that must never drift.
 */
function _finalizePlanFeaturesClient(plan, system, row) {
  const defNo = { bulkGenerate: false, maxDevices: 1, csvExport: false };
  const r = { ...defNo, ...row };
  const low = String(plan || '').toLowerCase();
  if (system === 'b') {
    if (low !== 'max' && low !== 'power') {
      r.bulkGenerate = false;
      r.csvExport = false;
    }
  }
  if (system === 'a') {
    if (low !== 'pro-key' && low !== 'prokey') {
      r.bulkGenerate = false;
      r.csvExport = false;
    }
    if (low === 'basic') {
      const md =
        typeof r.maxDevices === 'number' && r.maxDevices >= 1 ? r.maxDevices : 2;
      r.maxDevices = Math.min(md, 2);
    }
  }
  return r;
}

function _normalizeStoredPlanConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fbL = _fallbackPlanLimits();
  const fbF = _fallbackPlanFeatures();
  if (raw.planLimits && raw.planFeatures) {
    return {
      planLimits: {
        free: raw.planLimits.free ?? fbL.free,
        systemA: { ...fbL.systemA, ...(raw.planLimits.systemA || {}) },
        systemB: { ...fbL.systemB, ...(raw.planLimits.systemB || {}) }
      },
      planFeatures: {
        free: { ...fbF.free, ...(raw.planFeatures.free || {}) },
        systemA: {
          basic: { ...fbF.systemA.basic, ...(raw.planFeatures.systemA?.basic || {}) },
          standard: { ...fbF.systemA.standard, ...(raw.planFeatures.systemA?.standard || {}) },
          'pro-key': {
            ...fbF.systemA['pro-key'],
            ...(raw.planFeatures.systemA?.['pro-key'] || {})
          },
          proKey: { ...fbF.systemA.proKey, ...(raw.planFeatures.systemA?.proKey || {}) }
        },
        systemB: {
          starter: { ...fbF.systemB.starter, ...(raw.planFeatures.systemB?.starter || {}) },
          pro: { ...fbF.systemB.pro, ...(raw.planFeatures.systemB?.pro || {}) },
          power: { ...fbF.systemB.power, ...(raw.planFeatures.systemB?.power || {}) },
          max: { ...fbF.systemB.max, ...(raw.planFeatures.systemB?.max || {}) }
        }
      }
    };
  }
  if (raw.planLimits) {
    return {
      planLimits: {
        free: raw.planLimits.free ?? fbL.free,
        systemA: { ...fbL.systemA, ...(raw.planLimits.systemA || {}) },
        systemB: { ...fbL.systemB, ...(raw.planLimits.systemB || {}) }
      },
      planFeatures: fbF
    };
  }
  if (raw.systemA !== undefined || raw.systemB !== undefined || typeof raw.free === 'number') {
    return {
      planLimits: {
        free: typeof raw.free === 'number' ? raw.free : fbL.free,
        systemA: { ...fbL.systemA, ...(raw.systemA || {}) },
        systemB: { ...fbL.systemB, ...(raw.systemB || {}) }
      },
      planFeatures: fbF
    };
  }
  return null;
}

async function _getPlanConfig() {
  const now = Date.now();
  if (_planConfigCache && now - _planConfigFetchedAt < PLAN_CONFIG_TTL) {
    if (_planConfigCache.planLimits && _planConfigCache.planFeatures) {
      return _planConfigCache;
    }
    _planConfigCache = null;
  }

  const fallbackLimits = _fallbackPlanLimits();
  const fallbackFeatures = _fallbackPlanFeatures();

  try {
    const res = await fetch(`${WORKER_URL}/content?key=pricing`);
    if (!res.ok) throw new Error('Failed to fetch plan config');
    const data = await res.json();

    const merged = {
      planLimits: data?.planLimits
        ? {
            free: data.planLimits.free ?? fallbackLimits.free,
            systemA: {
              ...fallbackLimits.systemA,
              ...(data.planLimits.systemA || {})
            },
            systemB: {
              ...fallbackLimits.systemB,
              ...(data.planLimits.systemB || {})
            }
          }
        : fallbackLimits,
      planFeatures: data?.planFeatures
        ? {
            free: { ...fallbackFeatures.free, ...(data.planFeatures.free || {}) },
            systemA: {
              basic: {
                ...fallbackFeatures.systemA.basic,
                ...(data.planFeatures.systemA?.basic || {})
              },
              standard: {
                ...fallbackFeatures.systemA.standard,
                ...(data.planFeatures.systemA?.standard || {})
              },
              'pro-key': {
                ...fallbackFeatures.systemA['pro-key'],
                ...(data.planFeatures.systemA?.['pro-key'] || {})
              },
              proKey: {
                ...fallbackFeatures.systemA.proKey,
                ...(data.planFeatures.systemA?.proKey || {})
              }
            },
            systemB: {
              starter: {
                ...fallbackFeatures.systemB.starter,
                ...(data.planFeatures.systemB?.starter || {})
              },
              pro: {
                ...fallbackFeatures.systemB.pro,
                ...(data.planFeatures.systemB?.pro || {})
              },
              power: {
                ...fallbackFeatures.systemB.power,
                ...(data.planFeatures.systemB?.power || {})
              },
              max: {
                ...fallbackFeatures.systemB.max,
                ...(data.planFeatures.systemB?.max || {})
              }
            }
          }
        : fallbackFeatures
    };

    _planConfigCache = merged;
    _planConfigFetchedAt = now;
    // Cache upsell pricing so content.js popup shows live prices
    const upsellPricing = {
      silverBdt: data?.systemA?.proKey?.monthly ?? data?.systemA?.['pro-key']?.monthly ?? 99,
      goldenBdt: data?.systemB?.power?.monthly ?? 499,
      silverUsd: data?.systemA?.proKey?.monthlyUsd ?? data?.systemA?.['pro-key']?.monthlyUsd ?? 2,
      goldenUsd: data?.systemB?.power?.monthlyUsd ?? 5,
      goldenLimit: merged.planLimits?.systemB?.power ?? 300,
    };
    await chrome.storage.local.set({ pm_plan_config: merged, pm_upsell_pricing: upsellPricing });
    return merged;
  } catch {
    const { pm_plan_config } = await chrome.storage.local.get('pm_plan_config');
    const normalized = _normalizeStoredPlanConfig(pm_plan_config);
    if (normalized) {
      _planConfigCache = normalized;
      _planConfigFetchedAt = now;
      await chrome.storage.local.set({ pm_plan_config: normalized });
      return normalized;
    }
  }

  const out = { planLimits: fallbackLimits, planFeatures: fallbackFeatures };
  _planConfigCache = out;
  _planConfigFetchedAt = now;
  return out;
}

async function _getDailyLimitForPlan(plan, system) {
  const config = await _getPlanConfig();
  const limits = config.planLimits || config;
  if (!plan || !system) return limits.free || 10;
  const sysKey = system === 'a' ? 'systemA' : 'systemB';
  const bucket = limits[sysKey] || {};
  const pk = String(plan);
  if (typeof bucket[pk] === 'number') return bucket[pk];
  if (pk === 'pro-key' && typeof bucket.proKey === 'number') return bucket.proKey;
  if (pk === 'proKey' && typeof bucket['pro-key'] === 'number') return bucket['pro-key'];
  const fb = _fallbackPlanLimits();
  return system === 'a' ? 100 : fb.systemB.starter || 100;
}

async function _getPlanFeatures(plan, system) {
  const config = await _getPlanConfig();
  const features = config.planFeatures || {};
  const defNo = { bulkGenerate: false, maxDevices: 1, csvExport: false };
  if (!plan || !system) {
    const fr = { ...defNo, ...(features.free || {}) };
    return _finalizePlanFeaturesClient('', 'b', fr);
  }
  const sysKey = system === 'a' ? 'systemA' : 'systemB';
  const bucket = features[sysKey] || {};
  const pk = String(plan);
  let row = bucket[pk];
  if (!row && pk === 'pro-key' && bucket.proKey) row = bucket.proKey;
  if (!row && pk === 'proKey' && bucket['pro-key']) row = bucket['pro-key'];
  const rawRow = row ? { ...defNo, ...row } : defNo;
  return _finalizePlanFeaturesClient(plan, system, rawRow);
}

function _snapshotUserPlanFeaturesFromActivate(data) {
  const empty = { bulkGenerate: false, maxDevices: null, csvExport: false };
  if (!data || typeof data !== 'object') return { ...empty };
  const u =
    data.userPlanFeatures && typeof data.userPlanFeatures === 'object'
      ? data.userPlanFeatures
      : {};
  return {
    bulkGenerate: u.bulkGenerate === true,
    maxDevices:
      typeof u.maxDevices === 'number' && u.maxDevices >= 1
        ? u.maxDevices
        : null,
    csvExport: u.csvExport === true
  };
}

/** Clamp server snapshot to product caps (Master Vault + Ultimate Nexus for bulk/CSV). */
async function _mergeActivationUserPlanFeatures(data) {
  const system = String(data.system || 'b').toLowerCase() === 'a' ? 'a' : 'b';
  const plan = data.plan;
  const cfg = await _getPlanFeatures(plan, system);
  const u = _snapshotUserPlanFeaturesFromActivate(data);
  const mdU = u.maxDevices != null ? u.maxDevices : cfg.maxDevices;
  return {
    bulkGenerate: u.bulkGenerate === true && cfg.bulkGenerate === true,
    csvExport: u.csvExport === true && cfg.csvExport === true,
    maxDevices: Math.min(mdU, cfg.maxDevices)
  };
}

async function _refreshPlanConfigFromNetwork() {
  _planConfigCache = null;
  _planConfigFetchedAt = 0;
  await _getPlanConfig();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local
    .get([
      'pm_remaining',
      'pm_total',
      'hover_button_enabled',
      'pm_is_pro',
      'pm_plan',
      'pm_system',
      'pm_history_max'
    ])
    .then((d) => {
      const patch = {};
      if (d.pm_total === undefined) patch.pm_total = 10;
      if (d.pm_remaining === undefined) patch.pm_remaining = 10;
      if (d.hover_button_enabled === undefined) patch.hover_button_enabled = true;
      if (d.pm_history_max === undefined || d.pm_history_max === null) {
        patch.pm_history_max = _computeHistoryMax(
          !!d.pm_is_pro,
          d.pm_plan,
          d.pm_system
        );
      }
      if (Object.keys(patch).length) chrome.storage.local.set(patch);
    });

  _midnightResetHistoryIfNeeded().catch(() => {});
  try {
    chrome.alarms.create('pm_history_midnight', { periodInMinutes: 30 });
    chrome.alarms.create('pm_pricing_sync', { periodInMinutes: 15 });
    chrome.alarms.create('pm_quota_sync', { periodInMinutes: 30 });
    chrome.alarms.create('pm_admin_deactivated_check', { periodInMinutes: 2 });
  } catch {
    /* ignore */
  }

  _getPlanConfig().catch(() => {});

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'genDeepPrompt',
      title: '✨ Generate AI Prompt',
      contexts: ['image', 'page', 'selection', 'link']
    });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pm_history_midnight') {
    _midnightResetHistoryIfNeeded().catch(() => {});
  }
  if (alarm.name === 'pm_pricing_sync') {
    _refreshPlanConfigFromNetwork().catch(() => {});
  }
  if (alarm.name === 'pm_admin_deactivated_check') {
    // Check if admin re-activated — if so, clear gate and go free
    (async () => {
      try {
        const st = await chrome.storage.local.get(['pm_access_gate', 'pm_activated_email']);
        if (!st.pm_access_gate || st.pm_access_gate.code !== 'ADMIN_DEACTIVATED') return;
        const email = st.pm_activated_email;
        if (!email) return;
        const clientId = await _getClientId();
        const res = await fetch(`${WORKER_URL}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), clientId })
        });
        if (res.ok) {
          // Admin re-activated! Clear gate only — user will enter email to get full plan
          await chrome.storage.local.remove(['pm_access_gate', 'pm_restricted_until', 'pm_tamper_strikes']);
        }
      } catch { /* ignore */ }
    })();
  }
  if (alarm.name === 'pm_quota_sync') {
    // Silently sync quota from server every 2 min.
    // Guard: if local says remaining > 0 but sync returns allowed:false,
    // that is a KV stale false-positive — restore correct state so the
    // gate stays clear and the hover button does not block the user.
    (async () => {
      try {
        const preSyncSt = await chrome.storage.local.get(['pm_remaining', 'pm_plan']);
        const preSyncRem = typeof preSyncSt.pm_remaining === 'number' && !Number.isNaN(preSyncSt.pm_remaining)
          ? preSyncSt.pm_remaining : null;
        const r = await _syncServerQuota();
        // Only restore if errorCode is NOT DAILY_LIMIT_REACHED (real limit) — applies to all plans equally.
        if (r && r.allowed === false && r.errorCode !== 'DAILY_LIMIT_REACHED' && preSyncRem !== null && preSyncRem > 0 && preSyncRem < 999) {
          await chrome.storage.local.set({ pm_remaining: preSyncRem, pm_access_gate: null });
        }
      } catch {}
    })();
  }
});

chrome.runtime.onStartup.addListener(() => {
  _midnightResetHistoryIfNeeded().catch(() => {});
  try {
    chrome.alarms.create('pm_history_midnight', { periodInMinutes: 30 });
    chrome.alarms.create('pm_pricing_sync', { periodInMinutes: 15 });
    chrome.alarms.create('pm_quota_sync', { periodInMinutes: 30 });
    chrome.alarms.create('pm_admin_deactivated_check', { periodInMinutes: 2 });
  } catch {
    /* ignore */
  }
  _refreshPlanConfigFromNetwork().catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'genDeepPrompt' || !tab.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

  if (info.srcUrl) {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_LOADING' });
    try {
      const _t0 = Date.now();
      const r = await _pmGenerate(info.srcUrl, tab.id);
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_RESULT',
        prompt: r.prompt,
        detectedStyle: r.detectedStyle,
        elapsed: Date.now() - _t0
      });
    } catch (e) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', message: e.message });
    }
  } else {
    chrome.tabs.sendMessage(tab.id, { type: 'FIND_AND_GENERATE' });
  }
});

async function _getClientId() {
  const { pm_client_id: existing } = await chrome.storage.local.get('pm_client_id');
  if (existing) return existing;
  // Local storage was cleared — try to restore from sync backup (survives storage clear)
  try {
    const { pm_fp_id } = await chrome.storage.sync.get('pm_fp_id');
    if (pm_fp_id) {
      await chrome.storage.local.set({ pm_client_id: pm_fp_id });
      return pm_fp_id;
    }
  } catch {}
  // Generate new ID and back up to sync so it survives future storage clears
  const id = 'pm_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  await chrome.storage.local.set({ pm_client_id: id });
  try { await chrome.storage.sync.set({ pm_fp_id: id }); } catch {}
  return id;
}

function _getLocalDate() {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Generates a stable browser fingerprint from hardware/platform signals available
 * in the service worker context. Survives extension uninstall/reinstall on the same machine.
 * Used to detect free-tier abuse (repeated reinstalls from same computer).
 */
function _getBrowserFingerprint() {
  try {
    const parts = [
      (typeof navigator !== 'undefined' && navigator.platform) || '',
      (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 0,
      (typeof navigator !== 'undefined' && navigator.language) || '',
      new Date().getTimezoneOffset(),
    ].join('||');
    let h = 5381;
    for (let i = 0; i < parts.length; i++) {
      h = (Math.imul(h, 33) ^ parts.charCodeAt(i)) >>> 0;
    }
    return 'fp' + h.toString(36);
  } catch {
    return '';
  }
}

/** Prefer smaller/preview-style URLs for stock CDNs (less strict hotlink rules). */
function _normalizeSourceImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  try {
    const url = new URL(raw);
    const h = url.hostname.toLowerCase();
    if (h.includes('freepik')) {
      ['w', 'width'].forEach((k) => {
        if (!url.searchParams.has(k)) return;
        const n = parseInt(url.searchParams.get(k), 10);
        if (!Number.isNaN(n) && n > 520) url.searchParams.set(k, '480');
      });
      ['h', 'height'].forEach((k) => {
        if (!url.searchParams.has(k)) return;
        const n = parseInt(url.searchParams.get(k), 10);
        if (!Number.isNaN(n) && n > 520) url.searchParams.set(k, '480');
      });
      return url.toString();
    }
    if (h.includes('ftcdn.net') || h.includes('as2.ftcdn.net') || h.includes('stock.adobe')) {
      const next = url.pathname.replace(/\/(\d{3,5})x(\d{3,5})\//i, '/500x500/');
      if (next !== url.pathname) {
        url.pathname = next;
        return url.toString();
      }
    }
    if (h.includes('googleusercontent.com')) {
      let s = url.toString();
      s = s.replace(/=s\d{1,4}-c\b/gi, '=s1200-c').replace(/=s\d{1,4}\b/gi, '=s1200');
      s = s.replace(/=w\d{1,4}-h\d{1,4}\b/gi, '=w1200-h1200');
      return s;
    }
    return raw;
  } catch {
    return raw;
  }
}

const _PM_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const _PM_MIN_IMAGE_B64_LEN = 120;
const _PM_MIN_IMAGE_BYTES = 80;

function _bytesLookLikeHtml(u8) {
  if (!u8 || u8.length < 4) return false;
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return u8[3] === 0x3c;
  if (u8[0] === 0x3c) {
    const head = String.fromCharCode(u8[0], u8[1], u8[2], u8[3], u8[4] || 32).toLowerCase();
    return head.startsWith('<!do') || head.startsWith('<htm') || head.startsWith('<scr');
  }
  return false;
}

function _bytesLookLikeRasterImage(u8) {
  if (!u8 || u8.length < 12) return false;
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return true;
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return true;
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return true;
  if (
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  )
    return true;
  if (u8[0] === 0x42 && u8[1] === 0x4d) return true;
  const lim = Math.min(u8.length - 4, 96);
  for (let i = 4; i < lim; i++) {
    if (u8[i] === 0x66 && u8[i + 1] === 0x74 && u8[i + 2] === 0x79 && u8[i + 3] === 0x70) return true;
  }
  return false;
}

/**
 * Ensures we never send empty/HTML/error bodies as "images" to the worker.
 * Returns normalized base64 (no whitespace) when ok.
 */
function _validateImageBase64ForApi(b64, _mimeHint) {
  const s = String(b64 || '').replace(/\s+/g, '');
  if (!s) return { ok: false, reason: 'empty' };
  if (s.length < _PM_MIN_IMAGE_B64_LEN) return { ok: false, reason: 'too_small' };
  let bin;
  try {
    bin = atob(s);
  } catch {
    return { ok: false, reason: 'corrupt_base64' };
  }
  if (bin.length < _PM_MIN_IMAGE_BYTES) return { ok: false, reason: 'too_small' };
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  if (_bytesLookLikeHtml(u8)) return { ok: false, reason: 'html_not_image' };
  if (!_bytesLookLikeRasterImage(u8)) return { ok: false, reason: 'unsupported_format' };
  return { ok: true, normalizedB64: s };
}

function _friendlyInvalidImageUserMessage(reason) {
  const hint =
    'Try: right-click the image → Open image in new tab → then use VisionPrompt on that tab. Or use the hover ✨ button on the full image (not a tiny thumbnail).';
  if (reason === 'too_small')
    return `Image data was too small or empty (likely a placeholder). ${hint}`;
  if (reason === 'corrupt_base64')
    return `Image data could not be decoded (corrupt transfer). ${hint}`;
  if (reason === 'html_not_image')
    return `The URL returned a web page instead of an image (blocked or signed URL expired). ${hint}`;
  if (reason === 'unsupported_format')
    return `Unsupported or unrecognized image bytes (not JPEG/PNG/GIF/WebP/AVIF). ${hint}`;
  if (reason === 'empty') return `No image data was captured. ${hint}`;
  return `Invalid or unreadable image data. ${hint}`;
}

async function _tryFetchImageAsBase64Background(url, useCredentials) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const origin = new URL(url).origin;
    const res = await fetch(url, {
      credentials: useCredentials ? 'include' : 'omit',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: origin + '/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || !blob.size) return null;
    const ct = (blob.type || '').toLowerCase();
    if (ct.includes('text/html') || ct.includes('text/plain')) return null;
    if (!ct.startsWith('image/') && !ct.includes('octet-stream') && blob.size < 400) return null;
    const buf = await blob.arrayBuffer();
    if (buf.byteLength > _PM_MAX_IMAGE_BYTES) return null;
    if (buf.byteLength < _PM_MIN_IMAGE_BYTES) return null;
    const u8 = new Uint8Array(buf);
    if (_bytesLookLikeHtml(u8)) return null;
    if (!_bytesLookLikeRasterImage(u8)) return null;
    const mime = (blob.type || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    const imageBase64 = _b64FromBytes(u8);
    const v = _validateImageBase64ForApi(imageBase64, mime);
    if (!v.ok) return null;
    return { imageBase64: v.normalizedB64, mimeType: mime };
  } catch {
    return null;
  }
}

/**
 * Resolve image to raw base64 in the extension (page capture or background fetch)
 * so the worker receives imageBase64 and does not need to hotlink-fetch.
 */
async function _resolveImageForWorker(imageUrl, tabId) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (/^data:image\//i.test(imageUrl)) {
    const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/i);
    if (m && m[2] && m[2].length < _PM_MAX_IMAGE_BYTES * 1.4) {
      const v = _validateImageBase64ForApi(m[2], m[1]);
      if (v.ok) {
        return {
          imageBase64: v.normalizedB64,
          mimeType: (m[1] || 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
        };
      }
    }
  }
  if (tabId != null) {
    try {
      const cap = await chrome.tabs.sendMessage(tabId, {
        type: 'PM_CAPTURE_IMAGE',
        src: imageUrl,
        normalizedSrc: _normalizeSourceImageUrl(imageUrl)
      });
      if (cap && cap.ok && cap.dataUrl) {
        const m = String(cap.dataUrl).match(/^data:([^;]+);base64,(.+)$/i);
        if (m && m[2] && m[2].length < _PM_MAX_IMAGE_BYTES * 1.4) {
          const v = _validateImageBase64ForApi(m[2], m[1]);
          if (v.ok) {
            return {
              imageBase64: v.normalizedB64,
              mimeType: (m[1] || 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
            };
          }
        }
      }
    } catch {
      /* tab may not have content script */
    }
  }
  const a = _normalizeSourceImageUrl(imageUrl);
  const chain = a === imageUrl ? [imageUrl] : [a, imageUrl];
  for (let i = 0; i < chain.length; i++) {
    const hit = await _tryFetchImageAsBase64Background(chain[i], false);
    if (hit) return hit;
  }
  // Retry with session cookies — helps for CDN-protected images on sites where user is logged in
  for (let i = 0; i < chain.length; i++) {
    const hit = await _tryFetchImageAsBase64Background(chain[i], true);
    if (hit) return hit;
  }
  return null;
}

function _b64FromBytes(u8) {
  let s = '';
  u8.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function _bytesFromB64(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function _getWrapKeyRaw() {
  const { pm_wrap_key_b64: w } = await chrome.storage.local.get('pm_wrap_key_b64');
  if (w && typeof w === 'string' && w.length >= 40) {
    return _bytesFromB64(w);
  }
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  await chrome.storage.local.set({ pm_wrap_key_b64: _b64FromBytes(raw) });
  return raw;
}

async function _encryptApiVault(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  const keyBytes = await _getWrapKeyRaw();
  const ck = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ck, raw)
  );
  return { iv: _b64FromBytes(iv), ct: _b64FromBytes(ct) };
}

async function _decryptApiVault(v) {
  if (!v || !v.iv || !v.ct) return null;
  const keyBytes = await _getWrapKeyRaw();
  const ck = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const iv = _bytesFromB64(v.iv);
  const ct = _bytesFromB64(v.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ck, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

async function _readApiQueues() {
  const s = await chrome.storage.local.get([
    'pm_api_vault',
    'groq_api_key',
    'gemini_api_key'
  ]);
  let groq = [];
  let gemini = [];
  if (s.pm_api_vault && s.pm_api_vault.iv && s.pm_api_vault.ct) {
    try {
      const dec = await _decryptApiVault(s.pm_api_vault);
      if (dec && typeof dec === 'object') {
        groq = Array.isArray(dec.groq) ? dec.groq.map(String).filter(Boolean) : [];
        gemini = Array.isArray(dec.gemini)
          ? dec.gemini.map(String).filter(Boolean)
          : [];
      }
    } catch {
      groq = [];
      gemini = [];
    }
  }
  if (!groq.length && s.groq_api_key) groq = [String(s.groq_api_key)];
  if (!gemini.length && s.gemini_api_key) gemini = [String(s.gemini_api_key)];
  // gemini key read from user storage queue
  return { groq, gemini };
}

async function _writeApiQueues(groqIn, geminiIn) {
  const groq = (groqIn || [])
    .map((k) => String(k).trim())
    .filter(Boolean);
  const gemini = (geminiIn || [])
    .map((k) => String(k).trim())
    .filter(Boolean);
  if (!groq.length && !gemini.length) {
    await chrome.storage.local.remove([
      'pm_api_vault',
      'groq_api_key',
      'gemini_api_key',
      'pm_groq_rot_index',
      'pm_gemini_rot_index'
    ]);
    return;
  }
  const vault = await _encryptApiVault({ groq, gemini });
  await chrome.storage.local.set({ pm_api_vault: vault });
  await chrome.storage.local.remove(['groq_api_key', 'gemini_api_key']);
}

function _isGroqRotateErr(e) {
  const m = String((e && e.message) || e || '').toLowerCase();
  return (
    m.includes('429') ||
    m.includes('rate limit') ||
    m.includes('invalid groq') ||
    m.includes('401')
  );
}

function _isGeminiRotateErr(e) {
  const m = String((e && e.message) || e || '').toLowerCase();
  return (
    m.includes('429') ||
    m.includes('rate limit') ||
    m.includes('invalid gemini') ||
    m.includes('403') ||
    (m.includes('400') && m.includes('gemini'))
  );
}

async function _generateWithGroqRotating(imageUrl, style, keys) {
  if (!keys || !keys.length) {
    throw new Error('No Groq keys');
  }
  const { pm_groq_rot_index: idxRaw = 0 } = await chrome.storage.local.get(
    'pm_groq_rot_index'
  );
  const n = keys.length;
  const start = ((Number(idxRaw) || 0) % n + n) % n;
  const order = keys.slice(start).concat(keys.slice(0, start));
  let lastErr;
  for (let i = 0; i < order.length; i++) {
    try {
      const r = await _generateWithGroq(imageUrl, style, order[i]);
      const origIdx = keys.indexOf(order[i]);
      await chrome.storage.local.set({
        pm_groq_rot_index: (origIdx + 1) % n
      });
      return r;
    } catch (e) {
      lastErr = e;
      if (!_isGroqRotateErr(e)) throw e;
    }
  }
  throw lastErr || new Error('All Groq keys failed.');
}

async function _generateWithGeminiRotating(imageUrl, style, keys) {
  if (!keys || !keys.length) {
    throw new Error('No Gemini keys');
  }
  const { pm_gemini_rot_index: idxRaw = 0 } = await chrome.storage.local.get(
    'pm_gemini_rot_index'
  );
  const n = keys.length;
  const start = ((Number(idxRaw) || 0) % n + n) % n;
  const order = keys.slice(start).concat(keys.slice(0, start));
  let lastErr;
  for (let i = 0; i < order.length; i++) {
    try {
      const r = await _generateWithGemini(imageUrl, style, order[i]);
      const origIdx = keys.indexOf(order[i]);
      await chrome.storage.local.set({
        pm_gemini_rot_index: (origIdx + 1) % n
      });
      return r;
    } catch (e) {
      lastErr = e;
      if (!_isGeminiRotateErr(e)) throw e;
    }
  }
  throw lastErr || new Error('All Gemini keys failed.');
}

/** One in-flight /generate at a time so worker KV usage increments are not lost to races. */
let _pmGenLockBusy = false;
const _pmGenLockWaiters = [];

async function _pmAcquireGenerateLock() {
  while (_pmGenLockBusy) {
    await new Promise((resolve) => {
      _pmGenLockWaiters.push(resolve);
    });
  }
  _pmGenLockBusy = true;
}

function _pmReleaseGenerateLock() {
  _pmGenLockBusy = false;
  const next = _pmGenLockWaiters.shift();
  if (next) next();
}

async function _pmGenerate(imageUrl, tabId, opts = {}) {
  await _pmAcquireGenerateLock();
  try {
    const data = await chrome.storage.local.get([
      "prompt_style",
      "mj_stylize",
      "mj_chaos",
      "mj_tile"
    ]);
    const style = opts.style || data.prompt_style || "universal";
    const targetAr = opts.aspectRatio || "16:9";
    const resolved = await _resolveImageForWorker(imageUrl, tabId);

    const { groq: groqKeys, gemini: gemKeys } = await _readApiQueues();
    if (!groqKeys.length && !gemKeys.length) {
      throw new Error("PM_ERR:MISSING_USER_API_KEY\nPlease open the AI Vision Prompt extension and enter your Groq or Gemini API key in Settings.");
    }

    const modifiers = opts.modifiers || {
      stylize: data.mj_stylize || 250,
      chaos: data.mj_chaos || 0,
      tile: !!data.mj_tile
    };

    const out = await _generateWithOwnKey(imageUrl, style, {
      resolved,
      targetAr,
      modifiers,
      colors: opts.colors,
      isReroll: opts.isReroll
    });

    let finalPrompt = out.prompt || "";
    let extraParams = [];
    if (targetAr) extraParams.push("--ar " + targetAr);
    if (modifiers.stylize !== undefined && Number(modifiers.stylize) !== 250) extraParams.push("--s " + modifiers.stylize);
    if (modifiers.chaos && Number(modifiers.chaos) > 0) extraParams.push("--c " + modifiers.chaos);
    if (modifiers.tile) extraParams.push("--tile");

    if (extraParams.length > 0) {
      const paramStr = extraParams.join(" ");
      if (finalPrompt.includes("MAIN PROMPT:")) {
        const negIdx = finalPrompt.indexOf("NEGATIVE:");
        if (negIdx !== -1) {
          let mainPart = finalPrompt.slice(0, negIdx).trim();
          if (!mainPart.includes("--ar ")) {
            mainPart += " " + paramStr;
          }
          finalPrompt = mainPart + "\n\n" + finalPrompt.slice(negIdx).trim();
        } else if (!finalPrompt.includes("--ar ")) {
          finalPrompt += " " + paramStr;
        }
      } else if (!finalPrompt.includes("--ar ")) {
        finalPrompt += " " + paramStr;
      }
    }

    if (opts.colors && Array.isArray(opts.colors) && opts.colors.length > 0) {
      const paletteLine = "Color Palette: " + opts.colors.join(", ");
      if (finalPrompt.includes("IMAGE DETAILS:")) {
        finalPrompt = finalPrompt.trim() + "\n" + paletteLine;
      }
    }

    await _persistGenerateHistory(finalPrompt, out.detectedStyle || style);
    return { prompt: finalPrompt, detectedStyle: out.detectedStyle || style, colors: opts.colors };
  } finally {
    _pmReleaseGenerateLock();
  }
}

async function _generateWithOwnKey(imageUrl, style, opts = {}) {
  const customAr = opts.targetAr || "16:9";
  let effectiveImageUrl = imageUrl;
  if (opts.resolved && opts.resolved.imageBase64) {
    const mt = (opts.resolved.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    effectiveImageUrl = `data:${mt};base64,${opts.resolved.imageBase64}`;
  }
  const { groq: groqKeys, gemini: gemKeys } = await _readApiQueues();

  if (!groqKeys.length && !gemKeys.length) {
    throw new Error('No API key found. Please add your Groq key in Settings.');
  }

  const st = await chrome.storage.local.get([
    'pm_daily_limit',
    'pm_remaining'
  ]);
  const limit = st.pm_daily_limit ?? 100;
  let remaining = st.pm_remaining;
  if (remaining === undefined || remaining === null) remaining = limit;

  remaining = 999999;

  let result;
  if (groqKeys.length) {
    try {
      result = await _generateWithGroqRotating(effectiveImageUrl, style, groqKeys);
    } catch (e) {
      if (gemKeys.length && _isGroqRotateErr(e)) {
        result = await _generateWithGeminiRotating(effectiveImageUrl, style, gemKeys);
      } else {
        throw e;
      }
    }
  } else {
    result = await _generateWithGeminiRotating(effectiveImageUrl, style, gemKeys);
  }

  const newRemaining = Math.max(0, remaining - 1);
  await chrome.storage.local.set({
    pm_remaining: newRemaining,
    pm_server_confirmed_rem: newRemaining,
    pm_total: limit,
    pm_last_generate_ts: Date.now()
  });

  return {
    ...result,
    _quotaTruth: { remaining: newRemaining, limit }
  };
}

async function _generateWithServer(imageUrl, style, opts = {}) {
  const clientId = await _getClientId();
  const localDate = _getLocalDate();
  const resolved = opts.resolved || null;

  const preGuard = await chrome.storage.local.get([
    'pm_remaining',
    'pm_daily_limit',
    'pm_total',
    'pm_is_pro',
    'pm_system',
    'pm_plan',
    'pm_plan_display',
    'pm_access_gate',
    'pm_activated_email'
  ]);
  const gate = preGuard.pm_access_gate;
  const remG =
    typeof preGuard.pm_remaining === 'number' && !Number.isNaN(preGuard.pm_remaining)
      ? preGuard.pm_remaining
      : null;
  if (gate && gate.code && gate.message) {
    const c = String(gate.code);
    // DAILY_LIMIT_REACHED gate: clear automatically if remaining > 0 (stale gate from previous day)
    if (c === 'DAILY_LIMIT_REACHED' && remG !== null && remG > 0) {
      await chrome.storage.local.set({ pm_access_gate: null });
    } else if (
      c === 'UNREGISTERED_DEVICE' ||
      c === 'SUBSCRIPTION_INACTIVE' ||
      c === 'ADMIN_DEACTIVATED' ||
      c === 'DEVICE_LIMIT_EXCEEDED' ||
      c === 'DAILY_LIMIT_REACHED' ||
      c === 'MISSING_USER_API_KEY'
    ) {
      throw _workerAccessError(c, String(gate.message));
    }
  }
  const plLow = String(preGuard.pm_plan || '')
    .trim()
    .toLowerCase();
  if (remG !== null && remG <= 0 && plLow !== 'power') {
    await chrome.storage.local.set({ pm_remaining: 0 });
    throw _workerAccessError(
      'DAILY_LIMIT_REACHED',
      'Daily Limit Reached: You have used all your prompts for today. Your limit will reset at midnight. Upgrade to a higher plan for more daily prompts.'
    );
  }

  const genBody = { style, localDate };
  // Free users: include browser fingerprint for abuse detection (Layer 2+3)
  if (!preGuard.pm_is_pro) {
    const fp = _getBrowserFingerprint();
    if (fp) genBody.fp = fp;
  }
  if (opts.extensionBulk) {
    genBody.extensionBulk = true;
  }
  const plSysA =
    preGuard.pm_is_pro &&
    String(preGuard.pm_system || '').toLowerCase() === 'a';
  if (plSysA) {
    const { groq, gemini } = await _readApiQueues();
    const groqStr = (groq || []).filter(Boolean).join(',');
    const gemStr = (gemini || []).filter(Boolean).join(',');
    if (groqStr) genBody.userGroqKeys = groqStr;
    if (gemStr) genBody.userGeminiKeys = gemStr;
  }
  if (resolved && resolved.imageBase64) {
    const vImg = _validateImageBase64ForApi(resolved.imageBase64, resolved.mimeType);
    if (vImg.ok) {
      genBody.imageBase64 = vImg.normalizedB64;
      genBody.mimeType = resolved.mimeType || 'image/jpeg';
    } else {
      genBody.imageUrl = _normalizeSourceImageUrl(imageUrl);
    }
  } else {
    genBody.imageUrl = _normalizeSourceImageUrl(imageUrl);
  }

  let res;
  try {
    const genHeaders = {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId
    };
    const activatedEmail = String(preGuard.pm_activated_email || '').trim().toLowerCase();
    if (activatedEmail) genHeaders['X-User-Email'] = activatedEmail;
    res = await fetch(`${WORKER_URL}/generate`, {
      method: 'POST',
      headers: genHeaders,
      body: JSON.stringify(genBody)
    });
  } catch {
    // Auto-retry once after 1.5s — handles service worker cold-start and transient network blips.
    try {
      await new Promise((r) => setTimeout(r, 1500));
      res = await fetch(`${WORKER_URL}/generate`, {
        method: 'POST',
        headers: genHeaders,
        body: JSON.stringify(genBody)
      });
    } catch {
      throw new Error('Cannot reach server. Check your internet connection.');
    }
  }

  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new Error('Server response error. Please try again.');
  }

  const applyGate = async (code, msg) => {
    await chrome.storage.local.set({
      pm_access_gate: { code, message: msg }
    });
  };

  if (data.limitReached || res.status === 429) {
    const code = data.errorCode || 'DAILY_LIMIT_REACHED';
    const msg =
      data.userMessage ||
      data.error ||
      'Daily Limit Reached: You have used all your prompts for today. Your limit will reset at midnight. Upgrade to a higher plan for more daily prompts.';
    // If local still shows remaining > 0, the server edge node may have read a stale KV
    // replica. Verify with /quota before blocking — /quota is a fresh independent read.
    const preLimitSt = await chrome.storage.local.get(['pm_remaining']);
    const preLimitRem = typeof preLimitSt.pm_remaining === 'number' && !Number.isNaN(preLimitSt.pm_remaining)
      ? preLimitSt.pm_remaining : 0;
    if (preLimitRem > 0) {
      let quotaVerify = null;
      try { quotaVerify = await _syncServerQuota(); } catch (_qe) {}
      const afterSt = await chrome.storage.local.get(['pm_remaining']);
      const afterRem = typeof afterSt.pm_remaining === 'number' && !Number.isNaN(afterSt.pm_remaining)
        ? afterSt.pm_remaining : 0;
      if (quotaVerify && quotaVerify.ok !== false && afterRem > 0) {
        // /quota confirms remaining > 0 — generate response was from a stale KV replica.
        // Throw a non-blocking code so content.js does NOT show the daily limit modal.
        throw _workerAccessError('STALE_KV_RETRY', 'Server quota is syncing. Please try again in a moment.');
      }
    }
    await chrome.storage.local.set({ pm_remaining: 0, pm_server_confirmed_rem: 0 });
    await applyGate(code, msg);
    throw _workerAccessError(code, msg);
  }

  if (!res.ok || data.error) {
    const code = data.errorCode ? String(data.errorCode) : '';
    const msg = (data.userMessage || data.error || '').trim();
    if (code === 'SUBSCRIPTION_INACTIVE') {
      await _downgradeToFreeLocal();
      throw _workerAccessError(
        code,
        msg ||
          'Subscription Inactive: Your current plan has expired or is deactivated. Please renew your subscription from the website to continue.'
      );
    }
    if (code === 'FEATURE_FORBIDDEN') {
      throw _workerAccessError(
        code || 'FEATURE_FORBIDDEN',
        msg || 'This feature is not available on your plan.'
      );
    }
    if (
      code === 'UNREGISTERED_DEVICE' ||
      code === 'DEVICE_LIMIT_EXCEEDED' ||
      code === 'MISSING_USER_API_KEY' ||
      code === 'MISSING_CLIENT_ID' ||
      code === 'SERVER_ERROR'
    ) {
      if (msg) await applyGate(code, msg);
      throw _workerAccessError(
        code || 'ACCESS_DENIED',
        msg || 'Access denied.'
      );
    }
    const errRaw = String(data.error || '').trim();
    const errLow = errRaw.toLowerCase();
    if (
      res.status === 400 &&
      (errLow.includes('invalid image') ||
        errLow.includes('imageurl or imagebase64') ||
        errLow === 'invalid image data')
    ) {
      throw new Error(_friendlyInvalidImageUserMessage(''));
    }
    throw new Error(data.error || 'Server error. Please try again.');
  }

  await chrome.storage.local.set({ pm_access_gate: null });

  const remParsed =
    data.remaining != null && !Number.isNaN(Number(data.remaining))
      ? Math.max(0, Math.floor(Number(data.remaining)))
      : null;
  const limParsed =
    data.limit != null && !Number.isNaN(Number(data.limit)) && Number(data.limit) > 0
      ? Math.floor(Number(data.limit))
      : data.dailyLimit != null &&
          !Number.isNaN(Number(data.dailyLimit)) &&
          Number(data.dailyLimit) > 0
        ? Math.floor(Number(data.dailyLimit))
        : null;

  /** Same-origin POST response: authoritative for this generation (GET /quota can lag on KV). */
  let quotaTruth = null;

  if (remParsed != null) {
    const cap =
      limParsed != null && limParsed > 0
        ? limParsed
        : preGuard.pm_daily_limit || preGuard.pm_total || 10;
    // After a successful generation, remaining must be >= localPre-1.
    // Math.max prevents stale KV server responses (remaining=0) from
    // incorrectly setting pm_remaining=0 when the user still has prompts.
    // Genuine last-prompt case (localPre=1, remParsed=0): max(0, 0) = 0 ✓
    // Stale case (localPre=3, remParsed=0): max(0, 2) = 2 ✓
    const localPre = typeof preGuard.pm_remaining === 'number' && !Number.isNaN(preGuard.pm_remaining)
      ? preGuard.pm_remaining : cap;
    // Server verifies KV write before returning remaining — trust it directly.
    const trustedRem = remParsed >= 999 ? remParsed : Math.max(0, remParsed);
    const patchOk = {
      pm_remaining: trustedRem,
      pm_server_confirmed_rem: trustedRem,
      pm_total: cap,
      pm_last_date: _getLocalDate(),
      pm_last_generate_ts: Date.now()
    };
    if (limParsed != null && limParsed > 0) {
      patchOk.pm_daily_limit = limParsed;
    }
    await chrome.storage.local.set(patchOk);
    quotaTruth = { remaining: trustedRem, limit: cap };
  } else if (data.prompt) {
    const cur = await chrome.storage.local.get([
      'pm_remaining',
      'pm_total',
      'pm_daily_limit',
      'pm_is_pro',
      'pm_system'
    ]);
    const lim =
      (typeof cur.pm_daily_limit === 'number' && cur.pm_daily_limit > 0
        ? cur.pm_daily_limit
        : null) ||
      (typeof cur.pm_total === 'number' && cur.pm_total > 0 ? cur.pm_total : null) ||
      10;
    let r =
      typeof cur.pm_remaining === 'number' && !Number.isNaN(cur.pm_remaining)
        ? cur.pm_remaining
        : lim;
    r = Math.max(0, r - 1);
    await chrome.storage.local.set({
      pm_remaining: r,
      pm_server_confirmed_rem: r,
      pm_total: lim,
      pm_daily_limit: lim,
      pm_last_date: _getLocalDate(),
      pm_last_generate_ts: Date.now()
    });
    quotaTruth = { remaining: r, limit: lim };
  }

  return {
    prompt: data.prompt,
    detectedStyle: data.detectedStyle || null,
    _quotaTruth: quotaTruth
  };
}

async function _generateWithGroq(imageUrl, style, apiKey) {
  const stylePrompt =
    STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.universal;

  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        max_tokens: 1024,
        reasoning_effort: 'none',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: stylePrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });
  } catch {
    throw new Error('Cannot reach Groq API. Check your internet connection.');
  }

  if (res.status === 401) throw new Error('Invalid Groq API key. Check Settings.');
  if (res.status === 429) throw new Error('Groq rate limit. Try again in a moment.');

  const data = await res.json();
  if (data.error) throw new Error('Groq: ' + (data.error.message || 'Unknown error'));

  const generated = data.choices?.[0]?.message?.content?.trim();
  if (!generated) throw new Error('Empty response from Groq.');

  return { prompt: generated, detectedStyle: null };
}

async function _generateWithGemini(imageUrl, style, apiKey) {
  const stylePrompt =
    STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.universal;

  const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3.6-flash"];

  let imageBase64;
  let mimeType;
  const dataMatch =
    typeof imageUrl === 'string' &&
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(imageUrl)
      ? imageUrl.match(/^data:([^;]+);base64,(.+)$/i)
      : null;
  if (dataMatch) {
    mimeType = (dataMatch[1] || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    imageBase64 = dataMatch[2];
  } else {
    try {
      const imgRes = await fetch(imageUrl);
      const blob = await imgRes.blob();
      mimeType = blob.type || 'image/jpeg';
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      imageBase64 = btoa(binary);
    } catch {
      throw new Error('Cannot fetch image for Gemini. Try a different image.');
    }
  }

  for (const model of GEMINI_MODELS) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: stylePrompt },
                  { inline_data: { mime_type: mimeType, data: imageBase64 } }
                ]
              }
            ],
            generationConfig: { maxOutputTokens: 2048 }
          })
        }
      );
    } catch {
      throw new Error('Cannot reach Gemini API. Check your internet connection.');
    }

    if (res.status === 400 || res.status === 403) throw new Error('Invalid Gemini API key.');
    if (res.status === 429) throw new Error('Gemini rate limit. Try again.');

    const data = await res.json();
    if (data.error) {
      const msg = data.error.message || '';
      if (msg.includes('no longer available') || msg.includes('deprecated') || msg.includes('not found')) {
        continue; // try next model in list
      }
      throw new Error('Gemini: ' + (msg || 'Unknown error'));
    }

    const _parts = data.candidates?.[0]?.content?.parts || [];
    const _textPart = _parts.find((p) => !p.thought) || _parts[0];
    const generated = _textPart?.text?.trim();
    if (!generated) throw new Error('Empty response from Gemini.');

    return { prompt: generated, detectedStyle: null };
  }

  throw new Error('Gemini model unavailable. Please try again.');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GENERATE_FROM_CONTENT') {
    const tabId = sender && sender.tab && sender.tab.id;
    _pmGenerate(msg.src, tabId, {
      aspectRatio: msg.aspectRatio,
      style: msg.style,
      modifiers: msg.modifiers,
      colors: msg.colors,
      isReroll: !!msg.isReroll
    })
      .then((r) =>
        sendResponse({ prompt: r.prompt, detectedStyle: r.detectedStyle, colors: r.colors })
      )
      .catch((e) => {
        const _eMsg = String((e && e.message) || '');
        sendResponse({ error: _eMsg });
      });
    return true;
  }

  if (msg.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Capture failed' });
      } else {
        sendResponse({ ok: true, dataUrl });
      }
    });
    return true;
  }

  if (msg.type === 'GET_REMAINING') {
    chrome.storage.local
      .get([
        'pm_remaining',
        'pm_total',
        'pm_is_pro',
        'pm_system',
        'pm_last_date',
        'pm_client_id',
        'pm_daily_limit'
      ])
      .then(async (d) => {
        try {
          const today = new Date().toLocaleDateString('en-CA');
          const lastDate = d.pm_last_date || today;

          if (today !== lastDate && !d.pm_is_pro) {
            await chrome.storage.local.set({
              pm_remaining: 10,
              pm_total: 10,
              pm_last_date: today
            });
            sendResponse({
              remaining: 10,
              total: 10,
              system: d.pm_is_pro ? (d.pm_system || 'b') : 'b',
              reset: true
            });
            return;
          }

          await _syncServerQuota().catch(() => {});
          const fresh = await chrome.storage.local.get([
            'pm_remaining',
            'pm_total',
            'pm_is_pro',
            'pm_system',
            'pm_last_date',
            'pm_client_id',
            'pm_daily_limit'
          ]);

          const isPro = !!fresh.pm_is_pro;
          const dailyCap =
            typeof fresh.pm_daily_limit === 'number' &&
            !Number.isNaN(fresh.pm_daily_limit) &&
            fresh.pm_daily_limit > 0
              ? fresh.pm_daily_limit
              : null;
          let total = typeof fresh.pm_total === 'number' && fresh.pm_total > 0 ? fresh.pm_total : 10;
          if (isPro && dailyCap != null) total = dailyCap;
          let remaining =
            typeof fresh.pm_remaining === 'number' && !Number.isNaN(fresh.pm_remaining)
              ? fresh.pm_remaining
              : isPro && dailyCap != null
                ? dailyCap
                : 10;
          if (isPro && dailyCap != null && remaining > dailyCap) remaining = dailyCap;

          sendResponse({
            remaining,
            total,
            system: fresh.pm_is_pro ? (fresh.pm_system || 'b') : 'b'
          });
        } catch {
          sendResponse({
            remaining: 10,
            total: 10,
            system: 'b'
          });
        }
      });
    return true;
  }

  if (msg.type === 'GET_API_KEY_QUEUES') {
    _readApiQueues()
      .then((q) => sendResponse({ groq: q.groq, gemini: q.gemini }))
      .catch(() => sendResponse({ groq: [], gemini: [] }));
    return true;
  }

  if (msg.type === 'SAVE_API_KEY_QUEUES') {
    _writeApiQueues(msg.groq, msg.gemini)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message || 'Save failed' }));
    return true;
  }

  if (msg.type === 'CLEAR_API_KEYS') {
    chrome.storage.local
      .remove([
        'pm_api_vault',
        'groq_api_key',
        'gemini_api_key',
        'pm_groq_rot_index',
        'pm_gemini_rot_index',
        'pm_wrap_key_b64'
      ])
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'TEST_API_KEY') {
    _testApiKey(msg.provider, msg.key)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'ENSURE_CLIENT_ID') {
    _getClientId()
      .then((id) => sendResponse({ id }))
      .catch(() => sendResponse({ id: null }));
    return true;
  }

  if (msg.type === 'GET_HISTORY_MAX') {
    _resolveEffectiveHistoryMax()
      .then((max) => sendResponse({ max }))
      .catch(() => sendResponse({ max: 5 }));
    return true;
  }

  if (msg.type === 'APPEND_PROMPT_HISTORY') {
    _appendPromptHistoryBg(msg.prompt, msg.detectedStyle)
      .then((r) => sendResponse(r))
      .catch((e) =>
        sendResponse({ ok: false, count: 0, error: e.message || 'append_failed' })
      );
    return true;
  }

  if (msg.type === 'ACTIVATE_PRO') {
    _activatePro(msg.email)
      .then((r) => sendResponse(r))
      .catch((e) =>
        sendResponse({ success: false, error: e.message || 'Activation failed.' })
      );
    return true;
  }

  if (msg.type === 'REFRESH_PLAN_CONFIG') {
    _planConfigCache = null;
    _planConfigFetchedAt = 0;
    _getPlanConfig()
      .then(async (config) => {
        const s = await chrome.storage.local.get([
          'pm_is_pro',
          'pm_plan',
          'pm_system',
          'pm_remaining',
          'pm_daily_limit'
        ]);
        if (s.pm_is_pro && s.pm_plan) {
          const sys = s.pm_system === 'a' ? 'a' : 'b';
          const newL = await _getDailyLimitForPlan(s.pm_plan, sys);
          let rem = s.pm_remaining;
          if (rem === undefined || rem === null) rem = newL;
          if (rem > newL) rem = newL;
          const feats = await _getPlanFeatures(s.pm_plan, sys);
          const hMax = _computeHistoryMax(true, s.pm_plan, sys);
          await chrome.storage.local.set({
            pm_daily_limit: newL,
            pm_total: newL,
            pm_remaining: rem,
            pm_history_max: hMax,
            pm_user_plan_features: {
              bulkGenerate: feats.bulkGenerate === true,
              maxDevices:
                typeof feats.maxDevices === 'number' && feats.maxDevices >= 1
                  ? feats.maxDevices
                  : 1,
              csvExport: feats.csvExport === true
            }
          });
          await _trimHistoryToEffectiveCap();
        }
        sendResponse({ success: true, config });
      })
      .catch((e) =>
        sendResponse({ success: false, error: e.message || 'Refresh failed' })
      );
    return true;
  }

  if (msg.type === 'CHECK_BULK_FEATURE') {
    sendResponse({ allowed: true, reason: 'ok' });
    return true;
  }

  if (msg.type === 'CHECK_CSV_EXPORT') {
    sendResponse({ allowed: true, reason: 'ok' });
    return true;
  }

  if (msg.type === 'BULK_GENERATE_SINGLE') {
    const tabId = sender && sender.tab && sender.tab.id;
    (async () => {
      return _pmGenerate(msg.src, tabId, { extensionBulk: true, aspectRatio: msg.aspectRatio });
    })()
      .then((r) =>
        sendResponse({ prompt: r.prompt, detectedStyle: r.detectedStyle })
      )
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'DEREGISTER_DEVICE') {
    _deregisterDevice()
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ ok: false, error: 'network' }));
    return true;
  }

  if (msg.type === 'SYNC_SUBSCRIPTION') {
    _syncSubscriptionFromServer()
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ synced: false, error: 'sync_failed' }));
    return true;
  }

  if (msg.type === 'REPORT_TAMPER') {
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'SYNC_SERVER_QUOTA') {
    _syncServerQuota()
      .then(async (r) => {
        try {
          await chrome.storage.local.set({ pm_quota_ui_tick: Date.now() });
        } catch (e0) {}
        sendResponse(r);
      })
      .catch(() => sendResponse({ ok: false, error: 'sync_failed' }));
    return true;
  }

  return false;
});

async function _testApiKey(provider, key) {
  if (provider === 'groq') {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('Invalid Groq key');
    return true;
  }
  if (provider === 'gemini') {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    if (!r.ok) throw new Error('Invalid Gemini key');
    return true;
  }
  throw new Error('Unknown provider');
}

/** GET /quota — align local counters with server (free IP scope or Pro device). */
async function _syncServerQuota() {
  const clientId = await _getClientId();
  const localDate = _getLocalDate();
  const emailSt = await chrome.storage.local.get(['pm_activated_email']);
  const userEmail = typeof emailSt.pm_activated_email === 'string' ? emailSt.pm_activated_email.trim() : '';
  let res;
  try {
    const quotaHeaders = { 'X-Client-Id': clientId };
    if (userEmail) quotaHeaders['X-User-Email'] = userEmail;
    res = await fetch(
      `${WORKER_URL}/quota?localDate=${encodeURIComponent(localDate)}`,
      {
        method: 'GET',
        headers: quotaHeaders
      }
    );
  } catch {
    return { ok: false, error: 'network' };
  }
  let data = {};
  try {
    data = JSON.parse(await res.text());
  } catch {
    return { ok: false, error: 'parse' };
  }
  if (!data.success) {
    return { ok: false, error: data.error || 'quota_failed' };
  }
  if (data.allowed === false) {
    const code = data.errorCode || 'ACCESS_DENIED';
    const msg =
      data.userMessage ||
      data.error ||
      'Access denied.';
    // KV stale-data guard: only write gate + pm_remaining=0 if local storage
    // already shows 0 (or unknown). If local says > 0, the server KV is likely
    // returning a stale value — don't corrupt correct local state.
    // Exception: DAILY_LIMIT_REACHED is always authoritative — server confirmed real limit.
    const curSt = await chrome.storage.local.get(['pm_remaining', 'pm_plan']);
    const curRem = typeof curSt.pm_remaining === 'number' && !Number.isNaN(curSt.pm_remaining)
      ? curSt.pm_remaining : 0;
    if (code === 'DAILY_LIMIT_REACHED' || curRem <= 0 || curRem >= 999) {
      await chrome.storage.local.set({
        pm_access_gate: { code, message: msg },
        pm_remaining: 0
      });
    }
    return { ok: true, allowed: false, errorCode: code, userMessage: msg };
  }
  // Server may still see this device as Pro (stale device:<clientId> in KV)
  // even after local sign-out. Don't let that override the free-tier reset.
  if (data.isPro === true) {
    const { pm_is_pro: _localIsPro, pm_total: _staleTotal, pm_remaining: _staleRem } =
      await chrome.storage.local.get(['pm_is_pro', 'pm_total', 'pm_remaining']);
    if (!_localIsPro) {
      // Auto-deregister stale device from server — await so /generate sees free-tier immediately
      await _deregisterDevice().catch(() => {});
      const _stalePatch = { pm_access_gate: null };
      if ((_staleTotal && _staleTotal > 10) || (_staleRem && _staleRem > 10)) {
        _stalePatch.pm_total = 10;
        _stalePatch.pm_remaining = 10;
      }
      await chrome.storage.local.set(_stalePatch);
      return { ok: true, allowed: true, remaining: null, dailyLimit: null };
    }
  }
  const lim =
    typeof data.dailyLimit === 'number' && data.dailyLimit > 0
      ? data.dailyLimit
      : typeof data.limit === 'number' && data.limit > 0
        ? data.limit
        : null;
  let rem =
    typeof data.remaining === 'number' && !Number.isNaN(data.remaining)
      ? data.remaining
      : null;
  const usedTodayRaw =
    typeof data.promptsUsedToday === 'number' && !Number.isNaN(data.promptsUsedToday)
      ? data.promptsUsedToday
      : typeof data.usedToday === 'number' && !Number.isNaN(data.usedToday)
        ? data.usedToday
        : null;
  if (rem == null && lim != null && usedTodayRaw != null) {
    rem = Math.max(0, Math.floor(lim) - Math.max(0, Math.floor(usedTodayRaw)));
  }
  const patch = {
    pm_access_gate: null,
    pm_last_quota_sync: Date.now()
  };
  if (lim != null) {
    patch.pm_daily_limit = lim;
    patch.pm_total = lim;
  }
  if (rem != null) {
    // Server-confirmed floor guard: after each generation, server response sets pm_server_confirmed_rem.
    // If a sync (alarm/quota) returns MORE remaining than the last server-confirmed value, it is stale KV.
    // Accept server value only if: no confirmed floor yet, server ≤ confirmed (correct/multi-device),
    // admin increased the limit (limitIncreased), or confirmed floor is 0 (exhausted → admin may have reset).
    const staleGuard = await chrome.storage.local.get(['pm_server_confirmed_rem', 'pm_daily_limit']);
    const confirmedRem = typeof staleGuard.pm_server_confirmed_rem === 'number' && !Number.isNaN(staleGuard.pm_server_confirmed_rem)
      ? staleGuard.pm_server_confirmed_rem : null;
    const curLimit = typeof staleGuard.pm_daily_limit === 'number' ? staleGuard.pm_daily_limit : null;
    const limitIncreased = lim !== null && curLimit !== null && lim > curLimit;
    const serverIsStale = confirmedRem !== null && confirmedRem > 0 && rem > confirmedRem && !limitIncreased;
    if (!serverIsStale) {
      patch.pm_remaining = rem;
      if (confirmedRem !== null && rem < confirmedRem) {
        patch.pm_server_confirmed_rem = rem;
      }
    }
  }
  await chrome.storage.local.set(patch);
  return {
    ok: true,
    allowed: true,
    remaining: rem,
    dailyLimit: lim,
    promptsUsedToday: usedTodayRaw != null ? usedTodayRaw : data.promptsUsedToday
  };
}

/**
 * After a successful generation: GET /quota for multi-device sync, then clamp with the
 * POST /generate (or local own-key) snapshot so a stale KV read cannot raise `pm_remaining`
 * above the value we already got from this successful request.
 */
async function _finalizeGenerationQuotaUi(authoritativeFromRequest) {
  try { await _syncServerQuota(); } catch (e) {}

  const auth = authoritativeFromRequest;
  if (
    auth &&
    typeof auth.remaining === 'number' &&
    !Number.isNaN(auth.remaining)
  ) {
    try {
      const cur = await chrome.storage.local.get(['pm_remaining']);
      const syncedRem = cur.pm_remaining;
      const postRem = Math.max(0, Math.floor(auth.remaining));
      if (
        typeof syncedRem === 'number' &&
        !Number.isNaN(syncedRem) &&
        syncedRem > postRem
      ) {
        const patch = { pm_remaining: postRem, pm_quota_ui_tick: Date.now() };
        if (typeof auth.limit === 'number' && auth.limit > 0) {
          patch.pm_daily_limit = auth.limit;
          patch.pm_total = auth.limit;
        }
        await chrome.storage.local.set(patch);
      }
    } catch (eClamp) {}
  }

  try {
    await chrome.storage.local.set({ pm_quota_ui_tick: Date.now() });
  } catch (e2) {}
  try {
    chrome.runtime.sendMessage(
      { type: 'SYNC_SERVER_QUOTA', source: 'bg_quota' },
      () => void chrome.runtime.lastError
    );
  } catch (e3) {}
}

/** Align local gate + counters with GET /quota before each generation (multi-browser source of truth). */
async function _applyServerQuotaPreflight() {
  // Read local remaining BEFORE sync — if local says > 0, KV stale reads should not block generation
  const preSyncSt = await chrome.storage.local.get(['pm_remaining']);
  const preSyncRem = typeof preSyncSt.pm_remaining === 'number' && !Number.isNaN(preSyncSt.pm_remaining)
    ? preSyncSt.pm_remaining : null;

  const r = await _syncServerQuota();
  if (!r || r.ok === false) return;
  if (r.allowed === false) {
    // If local storage said > 0 before sync, the KV read is likely stale (eventual consistency).
    // Restore storage so downstream gate + remaining checks in _generateWithServer also pass.
    // The actual /generate endpoint on the server is the final authority.
    if (preSyncRem !== null && preSyncRem > 0 && preSyncRem < 999) {
      await chrome.storage.local.set({ pm_remaining: preSyncRem, pm_access_gate: null });
      return;
    }
    // preSyncRem was 0 — re-read pm_remaining after sync.
    // A concurrent alarm sync may have already updated it to > 0 (admin raised limit).
    const postSyncSt = await chrome.storage.local.get(['pm_remaining', 'pm_access_gate']);
    const postSyncRem = typeof postSyncSt.pm_remaining === 'number' && !Number.isNaN(postSyncSt.pm_remaining)
      ? postSyncSt.pm_remaining : 0;
    if (postSyncRem > 0 && postSyncRem < 999) return; // updated concurrently — proceed
    const gate = postSyncSt.pm_access_gate;
    if (gate && gate.code && gate.message) {
      throw _workerAccessError(String(gate.code), String(gate.message));
    }
  }
}

/** Sign-out: remove device:<clientId> from server KV so next quota/generate call is free-tier. */
async function _deregisterDevice() {
  const clientId = await _getClientId();
  try {
    const res = await fetch(`${WORKER_URL}/deregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId
      }
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * Refreshes Pro state from worker POST /activate (binds this device + returns authoritative
 * expires, daysLeft, plan, system, dailyLimit). Never derive days locally — use response fields only.
 */
async function _syncSubscriptionFromServer() {
  return { synced: true };
}

async function _activatePro(email) {
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'Email required' };
  }

  const clientId = await _getClientId();

  let res;
  try {
    res = await fetch(`${WORKER_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        clientId
      })
    });
  } catch {
    throw new Error('Cannot reach server. Check your internet connection.');
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: 'Server response error. Please try again.' };
  }

  if (res.status === 404) {
    return {
      success: false,
      error:
        'No subscription found for this email. Please check or purchase a plan.'
    };
  }

  if (res.status === 403) {
    const code = data.errorCode ? String(data.errorCode) : 'SUBSCRIPTION_INACTIVE';
    const msg =
      data.userMessage ||
      data.error ||
      (code === 'DEVICE_LIMIT_EXCEEDED'
        ? 'Access Denied: You have reached your device limit for this plan. Please logout from other devices/browsers or upgrade your plan to add more devices.'
        : 'Your subscription has expired. Please renew.');
    if (code === 'DEVICE_LIMIT_EXCEEDED' || code === 'UNREGISTERED_DEVICE') {
      await chrome.storage.local.set({
        pm_access_gate: { code, message: msg }
      });
    }
    if (code === 'SUBSCRIPTION_INACTIVE') {
      await _downgradeToFreeLocal();
    }
    if (code === 'ADMIN_DEACTIVATED') {
      // Clear tamper lockout only — keep pm_is_pro + pm_activated_email
      // so future popup opens can re-check the server
      await chrome.storage.local.remove(['pm_restricted_until', 'pm_tamper_strikes']);
      await chrome.storage.local.set({
        pm_access_gate: { code: 'ADMIN_DEACTIVATED', message: msg }
      });
    }
    return {
      success: false,
      error: msg,
      errorCode: code,
      userMessage: msg
    };
  }

  if (!res.ok || data.error) {
    return {
      success: false,
      error: data.error || 'Activation failed. Please try again.',
      errorCode: data.errorCode,
      userMessage: data.userMessage
    };
  }

  await _refreshPlanConfigFromNetwork();

  const system = data.system === 'a' ? 'a' : 'b';
  let dailyLimit = data.dailyLimit;
  if (!dailyLimit) {
    dailyLimit = await _getDailyLimitForPlan(data.plan, system);
  }

  const userFeat = await _mergeActivationUserPlanFeatures(data);
  const serverDays =
    typeof data.daysLeft === 'number' && !Number.isNaN(data.daysLeft)
      ? data.daysLeft
      : null;

  const histMax = _computeHistoryMax(true, data.plan, system);

  await chrome.storage.local.set({
    pm_is_pro: true,
    pm_activated_email: email.trim().toLowerCase(),
    pm_last_email: email.trim().toLowerCase(),
    pm_plan: data.plan,
    pm_plan_type: data.planType || '',
    pm_plan_display: data.planDisplayName || '',
    pm_system: system,
    pm_daily_limit: dailyLimit,
    pm_expires: data.expires || null,
    pm_days_left: serverDays,
    pm_total: dailyLimit,
    pm_remaining: dailyLimit,
    pm_history_max: histMax,
    pm_user_plan_features: userFeat,
    pm_access_gate: null
  });
  await _trimHistoryToEffectiveCap();
  await _syncServerQuota().catch(() => {});

  return {
    success: true,
    plan: data.plan,
    planType: data.planType || '',
    planDisplayName: data.planDisplayName,
    system,
    dailyLimit,
    expires: data.expires,
    daysLeft: serverDays,
    userPlanFeatures: userFeat,
    message: data.message
  };
}
