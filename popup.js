
// ── Local Image Dropzone Handler ──
document.addEventListener("DOMContentLoaded", () => {
  const dzCard = document.getElementById("dz-card");
  const fileInput = document.getElementById("dz-file-input");
  const resCard = document.getElementById("dz-result-card");
  const resText = document.getElementById("dz-res-text");
  const copyBtn = document.getElementById("dz-res-copy");

  if (!dzCard || !fileInput) return;

  dzCard.addEventListener("click", () => fileInput.click());

  dzCard.addEventListener("dragover", (e) => {
    e.preventDefault();
    dzCard.classList.add("dragover");
  });

  dzCard.addEventListener("dragleave", () => {
    dzCard.classList.remove("dragover");
  });

  dzCard.addEventListener("drop", (e) => {
    e.preventDefault();
    dzCard.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
    }
  });

  if (copyBtn && resText) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(resText.textContent);
        showToast("✓ Copied to clipboard!");
      } catch (_) {}
    });
  }

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      showToast("Please upload an image file (PNG, JPG, WEBP).", true);
      return;
    }

    const titleEl = dzCard.querySelector(".dz-title");
    const subEl = dzCard.querySelector(".dz-sub");
    const origTitle = titleEl ? titleEl.innerHTML : "";
    const origSub = subEl ? subEl.innerHTML : "";

    if (titleEl) titleEl.textContent = "⏳ Analyzing image with AI...";
    if (subEl) subEl.textContent = "Generating 3-part detailed prompt...";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = async () => {
        let ar = "16:9";
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w && h) {
          const r = w / h;
          if (r >= 2.0) ar = "21:9";
          else if (r >= 1.55) ar = "16:9";
          else if (r >= 1.35) ar = "3:2";
          else if (r >= 1.15) ar = "4:3";
          else if (r >= 0.92 && r <= 1.08) ar = "1:1";
          else if (r >= 0.72 && r < 0.92) ar = "4:5";
          else if (r >= 0.58 && r < 0.72) ar = "2:3";
          else if (r < 0.58) ar = "9:16";
        }

        try {
          const response = await chrome.runtime.sendMessage({
            type: "GENERATE_FROM_CONTENT",
            src: dataUrl,
            aspectRatio: ar
          });

          if (response && response.prompt) {
            if (resText) resText.textContent = response.prompt;
            if (resCard) resCard.style.display = "block";
            try {
              await navigator.clipboard.writeText(response.prompt);
              showToast("✨ Prompt generated & auto-copied!");
            } catch (_) {}
            await renderHistory();
            await updateHistoryCountBadge();
          } else if (response && response.error) {
            showToast(response.error, true);
          }
        } catch (err) {
          showToast((err && err.message) || "Failed to generate prompt.", true);
        } finally {
          if (titleEl) titleEl.innerHTML = origTitle;
          if (subEl) subEl.innerHTML = origSub;
          fileInput.value = "";
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }
});

// AI Vision Prompt — popup.js (new UI: email-only activation, no A/B toggle)

let activeStyle = 'universal';
let _verifiedPro = null;
const toastEl = () => document.getElementById('toast');

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (
    changes.pm_remaining !== undefined ||
    changes.pm_total !== undefined
  ) {
    void _refreshRemainingUI();
  }
});

async function _refreshRemainingUI() {
  const data = await chrome.storage.local.get([
    'pm_remaining',
    'pm_total',
    'pm_is_pro',
    'pm_system',
    'pm_daily_limit',
    'pm_access_gate',
    'pm_last_generate_ts',
    'pm_last_quota_sync'
  ]);

  let total = data.pm_total;
  if (total == null || Number.isNaN(total) || total <= 0) {
    total = data.pm_is_pro
      ? String(data.pm_system || '').toLowerCase() === 'a'
        ? data.pm_daily_limit || 100
        : data.pm_daily_limit || 50
      : 10;
  }
  // Free user: cap at 10 — prevents stale pro values from showing after signout
  if (!data.pm_is_pro && total > 10) total = 10;

  let remaining =
    typeof data.pm_remaining === 'number' && !Number.isNaN(data.pm_remaining)
      ? data.pm_remaining
      : total;
  // Free user: cap remaining at free tier max
  if (!data.pm_is_pro && remaining > 10) remaining = 10;

  const used = Math.max(0, total - remaining);

  const usedEl = document.getElementById('used-count');
  if (usedEl) usedEl.textContent = String(used);

  const remainingEl = document.getElementById('remaining-count');
  if (remainingEl) remainingEl.textContent = String(remaining);

  const totalEl = document.getElementById('total-count');
  if (totalEl) totalEl.textContent = String(total);

  const bar = document.getElementById('remaining-bar');
  if (bar) {
    const pct = total > 0 ? (remaining / total) * 100 : 0;
    bar.style.width = pct + '%';
    bar.classList.toggle('low', pct <= 30);

    if (pct > 50) {
      bar.style.background = 'linear-gradient(90deg,#3b82f6,#8b5cf6)';
    } else if (pct > 20) {
      bar.style.background = 'linear-gradient(90deg,#f59e0b,#ef4444)';
    } else {
      bar.style.background = '#ef4444';
    }
  }

  updateRemainingCardLabel(data);
  updateGenerationLimitState(data);

  // Limit nudge: show when free user has used 7+ out of 10 prompts
  const nudgeEl = document.getElementById('limit-nudge');
  if (nudgeEl) {
    const isFreeUser = !data.pm_is_pro;
    const nudgeUsed = typeof used === 'number' ? used : null;
    if (isFreeUser && nudgeUsed !== null && nudgeUsed >= 7 && total <= 10 && remaining > 0) {
      const todayStr = new Date().toLocaleDateString('en-CA');
      chrome.storage.local.get('pm_nudge_dismissed').then(nd => {
        if (nd.pm_nudge_dismissed !== todayStr) {
          const nudgeUsedEl = document.getElementById('nudge-used');
          if (nudgeUsedEl) nudgeUsedEl.textContent = String(nudgeUsed);
          nudgeEl.classList.add('show');
        }
      }).catch(() => {});
    } else {
      nudgeEl.classList.remove('show');
    }
  }
}

function quotaLimTotalFromData(d) {
  const isPro = !!d.pm_is_pro;
  const sysA = String(d.pm_system || '').toLowerCase() === 'a';
  if (isPro && sysA) return d.pm_daily_limit || d.pm_total || 100;
  if (isPro) return d.pm_daily_limit || d.pm_total || 50;
  return d.pm_total || 10;
}

/**
 * Remaining / total for the quota card. Pro · System B: if a generation finished after the
 * last GET /quota sync, show one fewer remaining until sync catches up.
 */
function quotaRemainingDisplayPair(d) {
  const lim = quotaLimTotalFromData(d);
  let rem =
    typeof d.pm_remaining === 'number' && !Number.isNaN(d.pm_remaining)
      ? d.pm_remaining
      : lim;
  const genTs = typeof d.pm_last_generate_ts === 'number' ? d.pm_last_generate_ts : 0;
  const syncTs =
    typeof d.pm_last_quota_sync === 'number' ? d.pm_last_quota_sync : 0;
  if (
    d.pm_is_pro &&
    genTs > syncTs &&
    rem > 0
  ) {
    rem = Math.max(0, rem - 1);
  }
  return { rem, lim };
}

function applyQuotaBarsFromStorage(d) {
  const { rem, lim } = quotaRemainingDisplayPair(d);
  updateRemaining(rem, lim);
}

/** Returns true if history was cleared for a new local-calendar day (user timezone). */
async function _midnightHistoryDateRoll() {
  return false;
}

async function _checkMidnightReset() {
  const cleared = await _midnightHistoryDateRoll();
  if (cleared) {
    showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg> New day — history cleared!');
  }
}

async function updateHistoryCountBadge() {
  const { prompt_history: history = [] } = await chrome.storage.local.get(
    'prompt_history'
  );
  const el = document.getElementById('history-nav-badge');
  if (!el) return;
  const n = history.length;
  el.textContent = n > 99 ? '99+' : String(n);
  el.classList.toggle('on', n > 0);
}

function _showAdminDeactivatedScreen() {
  const el = document.getElementById("admin-deactivated-screen");
  if (el) el.remove();
  const wrap = document.querySelector(".wrap");
  if (wrap) wrap.style.display = "block";
}

document.addEventListener('DOMContentLoaded', async () => {
  await chrome.storage.local.remove([
    "pm_restricted_until",
    "pm_tamper_strikes",
    "pm_access_gate"
  ]);
  const lockEl = document.getElementById("tamper-lock-screen");
  if (lockEl) lockEl.remove();
  const wrapEl = document.querySelector(".wrap");
  if (wrapEl) wrapEl.style.display = "block";

  await chrome.storage.local.set({
    pm_is_pro: true,
    pm_system: "a",
    pm_plan: "pro-key",
    pm_plan_display: "Silver",
    pm_daily_limit: 999999,
    pm_remaining: 999999,
    pm_total: 999999,
    pm_activated_email: "jahidul@local.pro",
    pm_expires: "2099-12-31T23:59:59Z",
    pm_days_left: 99999
  });

  const storageKeys = [
    'hover_button_enabled',
    'prompt_style',
    'pm_is_pro',
    'pm_activated_email',
    'pm_last_email',
    'pm_tamper_strikes',
    'pm_restricted_until',
    'pm_plan',
    'pm_plan_display',
    'pm_system',
    'pm_daily_limit',
    'pm_expires',
    'pm_days_left',
    'pm_remaining',
    'pm_total',
    'pm_client_id',
    'pm_access_gate',
    'pm_last_generate_ts',
    'pm_last_quota_sync',
    'pm_quota_ui_tick'
  ];

  // Read from local storage immediately — UI renders from cache, no network wait
  let data = await chrome.storage.local.get(storageKeys);

  // tamper check removed

  // ── Server check on popup open — catch ADMIN_DEACTIVATED ──
  // Only run if user is currently signed in (pm_is_pro=true). Do NOT use pm_last_email
  // after signout — that would re-activate a signed-out user automatically.
  // server check removed

  if (data.pm_is_pro && data.pm_plan) {
    const canonDisp = resolvePlanDisplayForPopup(data);
    if (canonDisp && data.pm_plan_display !== canonDisp) {
      await chrome.storage.local.set({ pm_plan_display: canonDisp });
      data.pm_plan_display = canonDisp;
    }
  }

  activeStyle = data.prompt_style || 'universal';
  setStyleActive(activeStyle);

  const hoverEl = document.getElementById('hover-toggle');
  if (hoverEl) hoverEl.checked = data.hover_button_enabled !== false;

  const cidRes = await chrome.runtime.sendMessage({ type: 'ENSURE_CLIENT_ID' }).catch(() => null);
  const cidEl = document.getElementById('client-id-val');
  if (cidEl) {
    cidEl.textContent = data.pm_client_id || cidRes?.id || 'Generating...';
  }

  applyQuotaBarsFromStorage(data);
  await _refreshRemainingUI();

  loadActivationState(data);
  renderApiKeyPanel();

  checkServerStatus();
  if (typeof _checkMidnightReset === 'function') {
    await _checkMidnightReset();
  }
  await renderHistory();
  await updateHistoryCountBadge();
  checkBulkFeature();

  // Background network sync — runs after UI is shown, never blocks popup open
  (async () => {
    await chrome.runtime.sendMessage({ type: 'SYNC_SERVER_QUOTA' }).catch(() => {});
    if (data.pm_is_pro && data.pm_activated_email) {
      const _bgSync = await chrome.runtime.sendMessage({ type: 'SYNC_SUBSCRIPTION' }).catch(() => null);
      if (_bgSync && _bgSync.synced === true) _verifiedPro = true;
      if (_bgSync && _bgSync.revoked === true) {
        const _bgD = await chrome.storage.local.get(['pm_tamper_strikes']);
        const _bs = (_bgD.pm_tamper_strikes || 0) + 1;
        const _bMs = _bs >= 3 ? 7*24*60*60*1000 : _bs === 2 ? 48*60*60*1000 : 24*60*60*1000;
        const _bUntil = Date.now() + _bMs;
        await chrome.storage.local.set({
          pm_tamper_strikes: _bs,
          pm_restricted_until: _bUntil,
          pm_access_gate: { code: 'SUSPICIOUS_ACTIVITY', message: 'Unauthorized activation detected.' }
        });
        chrome.runtime.sendMessage({ type: 'REPORT_TAMPER', strikes: _bs }).catch(() => {});
        const { prompt_history: _rh2 = [] } = await chrome.storage.local.get('prompt_history');
        if (_rh2.length > 0) {
          await chrome.storage.local.set({ prompt_history: _rh2.map(i => ({ ...i, exportBlocked: true })) });
        }
        _showTamperLockScreen(_bUntil, _bs);
        return;
      }
      await chrome.runtime.sendMessage({ type: 'SYNC_SERVER_QUOTA' }).catch(() => {});
    }
    // Quietly refresh UI with latest server data
    const _d2 = await chrome.storage.local.get(storageKeys);
    applyQuotaBarsFromStorage(_d2);
    updateRemainingCardLabel(_d2);
    updateGenerationLimitState(_d2);
    loadActivationState(_d2);
    await _refreshRemainingUI();
  })().catch(() => {});

  async function resyncPopupQuotaUi() {
    const snap = await chrome.storage.local.get(storageKeys);
    applyQuotaBarsFromStorage(snap);
    const pre = await chrome.storage.local.get(['pm_is_pro', 'pm_activated_email']);
    if (pre.pm_is_pro && pre.pm_activated_email) {
      await chrome.runtime.sendMessage({ type: 'SYNC_SUBSCRIPTION' }).catch(() => {});
    }
    await chrome.runtime.sendMessage({ type: 'SYNC_SERVER_QUOTA' }).catch(() => {});
    let d = await chrome.storage.local.get(storageKeys);
    if (d.pm_is_pro && d.pm_plan) {
      const cd = resolvePlanDisplayForPopup(d);
      if (cd && d.pm_plan_display !== cd) {
        await chrome.storage.local.set({ pm_plan_display: cd });
        d = { ...d, pm_plan_display: cd };
      }
    }
    applyQuotaBarsFromStorage(d);
    updateRemainingCardLabel(d);
    updateGenerationLimitState(d);
    loadActivationState(d);
    await updateHistoryCountBadge();
    await _refreshRemainingUI();
  }

  chrome.runtime.onMessage.addListener(function pmpBgQuotaMsg(msg) {
    if (!msg || msg.type !== 'SYNC_SERVER_QUOTA' || msg.source !== 'bg_quota') return;
    resyncPopupQuotaUi().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    resyncPopupQuotaUi().catch(() => {});
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const usageKeys = [
      'pm_daily_limit',
      'pm_remaining',
      'pm_plan_display',
      'pm_plan',
      'pm_is_pro',
      'pm_system',
      'pm_expires',
      'pm_days_left',
      'pm_last_generate_ts',
      'pm_last_quota_sync',
      'pm_quota_ui_tick',
      'pm_access_gate'
    ];
    if (usageKeys.some((k) => Object.prototype.hasOwnProperty.call(changes, k))) {
      chrome.storage.local.get(storageKeys).then((d) => {
        applyQuotaBarsFromStorage(d);
        updateRemainingCardLabel(d);
        updateGenerationLimitState(d);
        updateHistoryCountBadge();
        if (
          changes.pm_plan_display ||
          changes.pm_plan ||
          changes.pm_plan_type ||
          changes.pm_is_pro ||
          changes.pm_system ||
          changes.pm_daily_limit
        ) {
          loadActivationState(d);
        }
        void _refreshRemainingUI();
      });
    }

    if (!changes.prompt_history && !changes.pm_history_date) return;
    updateHistoryCountBadge();
    const histPg = document.getElementById('pg-history');
    if (histPg && histPg.classList.contains('on')) {
      renderHistory();
    }
  });

  const globe = document.getElementById('status-globe');
  if (globe) {
    globe.addEventListener('click', () => {
      chrome.tabs.create({ url: '#' });
    });
  }
});

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.pg').forEach((p) => { p.classList.remove('on'); p.classList.remove('anim'); });
    btn.classList.add('active');
    const pg = document.getElementById('pg-' + btn.dataset.pg);
    if (pg) {
      pg.classList.add('on');
      void pg.offsetWidth; // force reflow so the entrance animation replays every click
      pg.classList.add('anim');
    }
    if (btn.dataset.pg === 'history') {
      renderHistory();
    }
  });
});

const hoverToggle = document.getElementById('hover-toggle');
if (hoverToggle) {
  hoverToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ hover_button_enabled: enabled });
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, { type: 'HOVER_BUTTON_TOGGLE', enabled })
          .catch(() => {});
      });
    });
  });
}

document.querySelectorAll('.sty-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeStyle = btn.dataset.style;
    setStyleActive(activeStyle);
    chrome.storage.local.set({ prompt_style: activeStyle });
  });
});

function setStyleActive(style) {
  document.querySelectorAll('.sty-btn').forEach((b) => {
    b.classList.toggle('on', b.dataset.style === style);
  });
}

/**
 * Plan label for UI — must match pricing cards. Canonical internal `pm_plan` always wins
 * so stale cache or legacy server strings (e.g. "Basic (Own Key)") never show.
 */
function resolvePlanDisplayForPopup(data) {
  const tier = String(data.pm_plan || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  const byTier = {
    basic: 'Starter Core',
    standard: 'Creator Flow',
    'pro-key': 'Silver',
    prokey: 'Silver',
    starter: 'Instant Access',
    pro: 'Pro Stream',
    power: 'Golden',
    max: 'Diamond'
  };
  if (tier && byTier[tier]) return byTier[tier];
  const disp = (data.pm_plan_display && String(data.pm_plan_display).trim()) || '';
  return disp || 'Pro';
}

function systemLabelForPopup(sysLetter) {
  return sysLetter === 'a' ? 'System A — Own API key' : 'System B — Our servers';
}

function loadActivationState(data) {
  const stateInactive = document.getElementById('state-inactive');
  const stateProB = document.getElementById('state-pro-b');
  const stateProA = document.getElementById('state-pro-a');

  if (stateInactive) stateInactive.style.display = 'none';
  if (stateProB) stateProB.style.display = 'none';
  if (stateProA) stateProA.style.display = 'none';

  // ADMIN_DEACTIVATED → show inactive state with friendly message, not Pro Active
  const gateCode = data.pm_access_gate && data.pm_access_gate.code;
  if (gateCode === 'ADMIN_DEACTIVATED') {
    if (stateInactive) stateInactive.style.display = 'block';
    updateApiKeysMasterVisibility(data);
    updateRemainingCardLabel(data);
    updateGenerationLimitState(data);
    return;
  }

  if (!data.pm_is_pro || !data.pm_activated_email) {
    if (stateInactive) stateInactive.style.display = 'block';
    updateApiKeysMasterVisibility(data);
    updateRemainingCardLabel(data);
    updateGenerationLimitState(data);
    return;
  }

  const emailMasked = maskEmail(data.pm_activated_email);
  const planName = resolvePlanDisplayForPopup(data);
  const limit = data.pm_daily_limit ?? 10;
  const expiry = formatExpiryFromServer(data.pm_expires);
  const daysLeft = data.pm_days_left;

  const sys = data.pm_system === 'a' ? 'a' : 'b';
  const sysLine = systemLabelForPopup(sys);
  if (sys === 'b') {
    if (stateProB) stateProB.style.display = 'block';
    setText('pro-b-email', emailMasked);
    setText('pro-b-plan', planName);
    setText('pro-b-system', sysLine);
    setText('pro-b-limit', String(limit));
    setText('pro-b-expiry', expiry);
    setDays('pro-b-days', daysLeft);
  } else {
    if (stateProA) stateProA.style.display = 'block';
    setText('pro-a-email', emailMasked);
    setText('pro-a-plan', planName);
    setText('pro-a-system', sysLine);
    setText('pro-a-limit', String(limit));
    setText('pro-a-expiry', expiry);
    setDays('pro-a-days', daysLeft);
  }

  updateApiKeysMasterVisibility(data);
  updateRemainingCardLabel(data);
  updateGenerationLimitState(data);
}

function updateApiKeysMasterVisibility(data) {
  const wrap = document.getElementById("api-keys-master-wrap");
  if (wrap) wrap.style.display = "block";
}

function updateRemainingCardLabel(data) {
  const lbl = document.getElementById('remaining-label-el');
  const sub = document.getElementById('remaining-sub-el');
  if (!lbl) return;
  if (data.pm_is_pro && String(data.pm_system || '').toLowerCase() === 'a') {
    lbl.textContent = "Today's prompts";
    if (sub) sub.textContent = 'Plan limit · own API keys · resets at midnight in your timezone';
  } else if (data.pm_is_pro) {
    lbl.textContent = "Today's prompts";
    if (sub) {
      const { rem, lim } = quotaRemainingDisplayPair(data);
      if (!lim) {
        sub.textContent = 'Paid plan only (no free-tier credits) · resets at midnight in your timezone';
      } else {
        const used = Math.max(0, lim - rem);
        sub.textContent = `Cap ${lim}/day · ${used} used · ${rem} left · paid plan only · resets at midnight in your timezone`;
      }
    }
  } else {
    lbl.textContent = "Today's Free Prompts";
    if (sub) sub.textContent = 'Resets at midnight in your timezone';
  }
}

function updateGenerationLimitState(data) {
  const banner = document.getElementById('pm-daily-limit-banner');
  const unlocked = document.getElementById('bulk-unlocked');
  const bulk = document.getElementById('bulk-generate-btn');
  const bulkTxt = document.getElementById('bulk-btn-text');

  const isPro = Boolean(data.pm_is_pro);
  const gate = data.pm_access_gate;
  const gateCodes = new Set([
    'UNREGISTERED_DEVICE',
    'SUBSCRIPTION_INACTIVE',
    'ADMIN_DEACTIVATED',
    'DEVICE_LIMIT_EXCEEDED',
    'DAILY_LIMIT_REACHED',
    'MISSING_USER_API_KEY',
    'MISSING_CLIENT_ID',
    'SERVER_ERROR'
  ]);
  const gateBlock =
    gate &&
    typeof gate === 'object' &&
    gate.code &&
    gate.message &&
    gateCodes.has(String(gate.code));

  const rem =
    typeof data.pm_remaining === 'number' && !Number.isNaN(data.pm_remaining)
      ? data.pm_remaining
      : null;
  const cap =
    typeof data.pm_daily_limit === 'number' && !Number.isNaN(data.pm_daily_limit)
      ? data.pm_daily_limit
      : null;
  const totalFb =
    typeof data.pm_total === 'number' && !Number.isNaN(data.pm_total)
      ? data.pm_total
      : null;
  const dailyCap = cap != null && cap > 0 ? cap : totalFb;
  const limHit =
    dailyCap != null &&
    dailyCap > 0 &&
    rem != null &&
    rem <= 0;

  const bulkUnlockedVisible =
    unlocked && window.getComputedStyle(unlocked).display !== 'none';

  if (banner) {
    if (gateBlock && gate.code === 'ADMIN_DEACTIVATED') {
      banner.style.display = 'block';
      banner.textContent = '⏸ Your subscription is currently inactive. Please contact support@AI Vision or renew your plan at AI Vision';
    } else if (gateBlock) {
      banner.style.display = 'block';
      banner.textContent = String(gate.message);
    } else if (limHit) {
      banner.style.display = 'block';
      banner.textContent = isPro
        ? 'Daily limit reached for your plan (no extra free prompts). Resets at midnight in your timezone. Upgrade for a higher daily cap: Settings'
        : 'Daily Limit Reached — you have used all free prompts for today.';
    } else {
      banner.style.display = 'none';
      banner.textContent = '';
    }
  }

  if (bulk && bulkTxt) {
    if (!bulkUnlockedVisible) {
      bulk.disabled = true;
      bulk.style.opacity = '0.45';
      bulk.style.cursor = 'not-allowed';
      bulkTxt.textContent = 'Bulk Generate — locked';
    } else if (limHit || gateBlock) {
      bulk.disabled = true;
      bulk.style.opacity = '0.55';
      bulk.style.cursor = 'not-allowed';
      bulkTxt.textContent = gateBlock ? 'Access restricted' : 'Daily Limit Reached';
    } else {
      bulk.disabled = false;
      bulk.style.opacity = '';
      bulk.style.cursor = '';
      bulkTxt.textContent = 'Bulk Generate This Page';
    }
  }
}

function maskEmail(email) {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const local = parts[0] || '';
  const domain = parts.slice(1).join('@');
  const head = local.slice(0, Math.min(3, local.length));
  return head + '***@' + domain;
}

/** Show calendar date from server ISO without local timezone shifting the day. */
function formatExpiryFromServer(isoDate) {
  if (!isoDate) return '—';
  const s = String(isoDate);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    try {
      return new Date(s).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return s;
    }
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setDays(id, daysLeft) {
  const el = document.getElementById(id);
  if (!el) return;
  if (daysLeft !== undefined && daysLeft !== null) {
    el.textContent = `(${daysLeft} days left)`;
    el.className = 'pro-days' + (daysLeft <= 5 ? ' urgent' : '');
  } else {
    el.textContent = '';
    el.className = 'pro-days';
  }
}

const actBtn = document.getElementById('act-btn');
if (actBtn) {
  actBtn.addEventListener('click', async () => {
    const emailInp = document.getElementById('act-email-inp');
    const email = emailInp ? emailInp.value.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      showActError('Please enter a valid email address.');
      return;
    }

    actBtn.textContent = '⏳';
    actBtn.disabled = true;
    hideActError();

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'ACTIVATE_PRO',
        email
      });

      if (result && result.success) {
        const newData = await chrome.storage.local.get([
          'pm_is_pro',
          'pm_activated_email',
          'pm_plan',
          'pm_plan_type',
          'pm_plan_display',
          'pm_system',
          'pm_daily_limit',
          'pm_expires',
          'pm_days_left',
          'pm_remaining',
          'pm_total',
        ]);
        const merged = {
          ...newData,
          pm_plan: result.plan ?? newData.pm_plan,
          pm_plan_type: result.planType ?? newData.pm_plan_type,
          pm_plan_display: result.planDisplayName ?? newData.pm_plan_display,
          pm_system: result.system ?? newData.pm_system,
          pm_daily_limit: result.dailyLimit ?? newData.pm_daily_limit,
          pm_expires: result.expires != null ? result.expires : newData.pm_expires,
          pm_days_left:
            typeof result.daysLeft === 'number' && !Number.isNaN(result.daysLeft)
              ? result.daysLeft
              : newData.pm_days_left
        };
        const lim =
          merged.pm_daily_limit ??
          result.dailyLimit ??
          (String(merged.pm_system || '').toLowerCase() === 'a' ? 100 : 50);
        const rem = merged.pm_remaining ?? lim;
        updateRemaining(rem, lim);
        updateRemainingCardLabel(merged);
        updateGenerationLimitState(merged);
        loadActivationState(merged);

        await _refreshRemainingUI();

        const freeSection = document.getElementById('free-prompts-section');
        if (freeSection && merged.pm_is_pro) {
          freeSection.style.display = 'none';
        }
        const sectionTitle =
          document.querySelector('.prompts-section-title') ||
          document.getElementById('remaining-label-el');
        if (sectionTitle) {
          sectionTitle.textContent = merged.pm_is_pro
            ? "TODAY'S PROMPTS"
            : "TODAY'S FREE PROMPTS";
        }

        checkBulkFeature();
        renderHistory();
        renderApiKeyPanel();
        await chrome.storage.local.remove(['pm_restricted_until', 'pm_tamper_strikes', 'pm_access_gate']);
        _verifiedPro = true;
        showToast('🎉 Plan activated successfully!');
      } else {
        showActError(
          result?.userMessage ||
            result?.error ||
            'Activation failed. Check your email.'
        );
        return;
      }
    } catch {
      showActError('Connection error. Please try again.');
      return;
    }

    actBtn.textContent = 'Activate';
    actBtn.disabled = false;
  });
}

function showActError(msg) {
  const el = document.getElementById('act-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
  const btn = document.getElementById('act-btn');
  if (btn) {
    btn.textContent = 'Activate';
    btn.disabled = false;
  }
}

function hideActError() {
  const el = document.getElementById('act-error');
  if (el) el.style.display = 'none';
}

['signout-btn-a', 'signout-btn-b'].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', async () => {
      // Deregister device from server so free-tier quota applies immediately
      chrome.runtime.sendMessage({ type: 'DEREGISTER_DEVICE' }).catch(() => {});
      await chrome.storage.local.remove([
        'pm_is_pro',
        'pm_activated_email',
        'pm_plan',
        'pm_plan_type',
        'pm_plan_display',
        'pm_system',
        'pm_daily_limit',
        'pm_expires',
        'pm_days_left',
        'pm_user_plan_features',
        'pm_access_gate',
        'pm_server_confirmed_rem',
        'pm_last_date',
        'pm_last_generate_ts',
        'pm_last_quota_sync'
      ]);
      _verifiedPro = null;
      await chrome.storage.local.set({
        pm_total: 10,
        pm_remaining: 10,
        pm_history_max: 9999
      });
      updateRemaining(10, 10);
      const postSignout = await chrome.storage.local.get([
        'pm_is_pro',
        'pm_system',
        'pm_remaining',
        'pm_daily_limit',
        'pm_total'
      ]);
      updateRemainingCardLabel(postSignout);
      updateGenerationLimitState(postSignout);

      const stateInactive = document.getElementById('state-inactive');
      const stateProB = document.getElementById('state-pro-b');
      const stateProA = document.getElementById('state-pro-a');
      if (stateProB) stateProB.style.display = 'none';
      if (stateProA) stateProA.style.display = 'none';
      if (stateInactive) stateInactive.style.display = 'block';

      showToast('👋 Signed out');
      checkBulkFeature();
      renderHistory();
    });
  }
});

/** CSV history export: Master Vault (pro-key) or Ultimate Nexus (max) — matches product comparison table. */
async function resolveCsvExportAllowed() {
  return true;
}

async function patchHistoryCsvButtonState() {
  const exportBtn = document.getElementById('export-csv-btn');
  if (!exportBtn) return;
  const { prompt_history: history = [] } = await chrome.storage.local.get(
    'prompt_history'
  );
  const csvOk = await resolveCsvExportAllowed();
  const canExport = history.length > 0 && csvOk;
  exportBtn.disabled = !csvOk;
  exportBtn.style.opacity = canExport ? '1' : csvOk && history.length ? '0.5' : '0.35';
  exportBtn.style.cursor = csvOk ? 'pointer' : 'not-allowed';
  exportBtn.title = csvOk
    ? history.length
      ? ''
      : 'Generate prompts to export CSV'
    : 'CSV export is only on Silver or Golden — upgrade on Settings';
}

async function checkBulkFeature() {
  const lockedEl = document.getElementById('bulk-locked');
  const unlockedEl = document.getElementById('bulk-unlocked');
  const lockSub = document.getElementById('bulk-lock-sub');
  if (!lockedEl || !unlockedEl) return;

  try {
    const st = await chrome.storage.local.get([
      'pm_is_pro',
      'pm_system',
      'pm_plan',
      'pm_plan_type'
    ]);
    if (!st.pm_is_pro) {
      if (lockSub) lockSub.textContent = 'Pro feature — upgrade to unlock';
      lockedEl.style.display = 'none';
      unlockedEl.style.display = 'flex';
      return;
    }
    const r = await chrome.runtime.sendMessage({ type: 'CHECK_BULK_FEATURE' });
    if (r && r.allowed) {
      lockedEl.style.display = 'none';
      unlockedEl.style.display = 'block';
    } else {
      if (lockSub) {
        const sys = st.pm_system === 'a' ? 'a' : 'b';
        const pt = String(st.pm_plan_type || '').toLowerCase();
        const pl = String(st.pm_plan || '')
          .trim()
          .toLowerCase();
        const isStarterOrCreator =
          sys === 'a' && (pl === 'basic' || pl === 'standard');
        lockSub.textContent = isStarterOrCreator
          ? 'Upgrade to Silver to unlock Bulk Generate.'
          : 'Upgrade to Silver or Golden to unlock Bulk Generate.';
      }
      lockedEl.style.display = 'flex';
      unlockedEl.style.display = 'none';
    }
  } catch {
    lockedEl.style.display = 'flex';
    unlockedEl.style.display = 'none';
  } finally {
    try {
      const limSt = await chrome.storage.local.get([
        'pm_is_pro',
        'pm_system',
        'pm_remaining',
        'pm_daily_limit',
        'pm_total'
      ]);
      updateGenerationLimitState(limSt);
      patchHistoryCsvButtonState();
    } catch (_) {}
  }
}

const bulkBtn = document.getElementById('bulk-generate-btn');
if (bulkBtn) {
  bulkBtn.addEventListener('click', async () => {
    const gate = await chrome.runtime
      .sendMessage({ type: 'CHECK_BULK_FEATURE' })
      .catch(() => ({ allowed: false }));
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch {
      return;
    }

    if (!gate || !gate.allowed) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_ERROR',
        message:
          'PM_ERR:BULK_PLAN_RESTRICTED\nUpgrade to Silver or Golden to use Bulk Generate.'
      }).catch(() => {});
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'START_BULK_SELECT' }).catch(() => {});
  });
}

function splitKeyTokens(str) {
  return String(str || '')
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function clearRowBadges(row) {
  row.classList.remove('row-valid', 'row-invalid');
  const ok = row.querySelector('.key-badge-ok');
  const bad = row.querySelector('.key-badge-bad');
  if (ok) ok.style.display = 'none';
  if (bad) bad.style.display = 'none';
}

function setRowValidationUI(row, state) {
  clearRowBadges(row);
  const ok = row.querySelector('.key-badge-ok');
  const bad = row.querySelector('.key-badge-bad');
  if (state === 'ok') {
    row.classList.add('row-valid');
    if (ok) ok.style.display = 'inline-flex';
  } else if (state === 'bad') {
    row.classList.add('row-invalid');
    if (bad) bad.style.display = 'inline-flex';
  }
}

function renumberKeyRows(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  [...wrap.querySelectorAll('.key-adv-row')].forEach((row, i) => {
    const n = row.querySelector('.key-num');
    if (n) n.textContent = String(i + 1);
  });
}

function estimateStatsForProvider(containerId, inputSel, provider) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return { total: 0, active: 0, invalid: 0 };
  let total = 0;
  let active = 0;
  wrap.querySelectorAll('.key-adv-row').forEach((row) => {
    const inp = row.querySelector(inputSel);
    splitKeyTokens(inp ? inp.value : '').forEach((k) => {
      total += 1;
      if (provider === 'groq' && k.startsWith('gsk_')) active += 1;
      if (provider === 'gemini' && (k.startsWith('AIza') || k.startsWith('AQ.') || k.length >= 20)) active += 1;
    });
  });
  return { total, active, invalid: Math.max(0, total - active) };
}

function setProviderStatIds(pref, stats) {
  const tEl = document.getElementById(`stat-${pref}-total`);
  const aEl = document.getElementById(`stat-${pref}-active`);
  const iEl = document.getElementById(`stat-${pref}-invalid`);
  if (tEl) tEl.textContent = String(stats.total);
  if (aEl) aEl.textContent = String(stats.active);
  if (iEl) iEl.textContent = String(stats.invalid);
}

function refreshKeyDashboards() {
  setProviderStatIds(
    'groq',
    estimateStatsForProvider('groq-keys-list', 'input.pm-groq-input', 'groq')
  );
  setProviderStatIds(
    'gemini',
    estimateStatsForProvider('gemini-keys-list', 'input.pm-gemini-input', 'gemini')
  );
}

function addApiKeyRow(containerId, inputClass, placeholder, value) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'key-adv-row';
  const num = document.createElement('span');
  num.className = 'key-num';
  num.textContent = '1';
  const inp = document.createElement('input');
  inp.type = 'password';
  inp.className = `key-input ${inputClass}`;
  inp.setAttribute('autocomplete', 'off');
  inp.placeholder = placeholder;
  if (value) inp.value = value;
  const ok = document.createElement('span');
  ok.className = 'key-badge-row key-badge-ok';
  ok.innerHTML = '<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg> OK';
  ok.style.display = 'none';
  const bad = document.createElement('span');
  bad.className = 'key-badge-row key-badge-bad';
  bad.innerHTML = '<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  bad.style.display = 'none';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'key-del-xs';
  del.textContent = '\u00d7';
  del.setAttribute('aria-label', 'Remove row');
  del.addEventListener('click', () => {
    const rows = wrap.querySelectorAll('.key-adv-row');
    if (rows.length <= 1) {
      inp.value = '';
      clearRowBadges(row);
      refreshKeyDashboards();
      return;
    }
    row.remove();
    renumberKeyRows(containerId);
    refreshKeyDashboards();
  });
  inp.addEventListener('input', () => {
    clearRowBadges(row);
    refreshKeyDashboards();
  });
  row.appendChild(num);
  row.appendChild(inp);
  row.appendChild(ok);
  row.appendChild(bad);
  row.appendChild(del);
  wrap.appendChild(row);
  renumberKeyRows(containerId);
  refreshKeyDashboards();
}

async function renderApiKeyPanel() {
  const gList = document.getElementById('groq-keys-list');
  const mList = document.getElementById('gemini-keys-list');
  if (!gList || !mList) return;
  gList.innerHTML = '';
  mList.innerHTML = '';
  const r = await chrome.runtime
    .sendMessage({ type: 'GET_API_KEY_QUEUES' })
    .catch(() => null);
  const gq =
    r && Array.isArray(r.groq) && r.groq.length ? r.groq : [''];
  const gm =
    r && Array.isArray(r.gemini) && r.gemini.length ? r.gemini : [''];
  gq.forEach((k) =>
    addApiKeyRow('groq-keys-list', 'pm-groq-input', 'gsk_...', k || '')
  );
  gm.forEach((k) =>
    addApiKeyRow('gemini-keys-list', 'pm-gemini-input', 'AIza...', k || '')
  );
  refreshKeyDashboards();
}

function setActiveKeyTab(which) {
  document.querySelectorAll('.key-tab').forEach((t) => {
    const on = t.dataset.tab === which;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const gPanel = document.getElementById('panel-groq');
  const mPanel = document.getElementById('panel-gemini');
  if (gPanel) gPanel.classList.toggle('on', which === 'groq');
  if (mPanel) mPanel.classList.toggle('on', which === 'gemini');
}

document.querySelectorAll('.key-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    setActiveKeyTab(tab.dataset.tab || 'groq');
  });
});

const groqAddDashed = document.getElementById('groq-add-dashed');
if (groqAddDashed) {
  groqAddDashed.addEventListener('click', () => {
    addApiKeyRow('groq-keys-list', 'pm-groq-input', 'gsk_...', '');
  });
}
const gemAddDashed = document.getElementById('gemini-add-dashed');
if (gemAddDashed) {
  gemAddDashed.addEventListener('click', () => {
    addApiKeyRow('gemini-keys-list', 'pm-gemini-input', 'AIza...', '');
  });
}

function walkRowKeysForTest(containerId, inputSel) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return [];
  const jobs = [];
  wrap.querySelectorAll('.key-adv-row').forEach((row) => {
    const inp = row.querySelector(inputSel);
    const keys = splitKeyTokens(inp ? inp.value : '');
    jobs.push({ row, keys });
  });
  return jobs;
}

async function validateRowsForProvider(containerId, inputSel, provider) {
  const jobs = walkRowKeysForTest(containerId, inputSel);
  jobs.forEach((job) => clearRowBadges(job.row));

  let total = 0;
  let active = 0;
  let invalid = 0;
  let hadError = false;

  for (const job of jobs) {
    if (!job.keys.length) {
      setRowValidationUI(job.row, 'none');
      continue;
    }
    let rowOk = true;
    for (const k of job.keys) {
      total += 1;
      if (provider === 'groq' && !k.startsWith('gsk_')) {
        invalid += 1;
        rowOk = false;
        hadError = true;
        continue;
      }
      if (provider === 'gemini' && !(k.startsWith('AIza') || k.startsWith('AQ.') || k.length >= 20)) {
        invalid += 1;
        rowOk = false;
        hadError = true;
        continue;
      }
      const test = await chrome.runtime.sendMessage({
        type: 'TEST_API_KEY',
        provider,
        key: k
      });
      if (!test?.ok) {
        invalid += 1;
        rowOk = false;
        hadError = true;
      } else {
        active += 1;
      }
    }
    setRowValidationUI(job.row, rowOk ? 'ok' : 'bad');
  }

  return { total, active, invalid, hadError };
}

const saveValidateBtn = document.getElementById('save-validate-keys-btn');
if (saveValidateBtn) {
  saveValidateBtn.addEventListener('click', async () => {
    const groqJobs = walkRowKeysForTest('groq-keys-list', 'input.pm-groq-input');
    const groqFlat = [];
    groqJobs.forEach((j) => j.keys.forEach((k) => groqFlat.push(k)));
    const gemJobs = walkRowKeysForTest(
      'gemini-keys-list',
      'input.pm-gemini-input'
    );
    const gemFlat = [];
    gemJobs.forEach((j) => j.keys.forEach((k) => gemFlat.push(k)));

    if (!groqFlat.length && !gemFlat.length) {
      saveValidateBtn.textContent = '⏳';
      saveValidateBtn.disabled = true;
      const res = await chrome.runtime.sendMessage({
        type: 'SAVE_API_KEY_QUEUES',
        groq: [],
        gemini: []
      });
      saveValidateBtn.disabled = false;
      saveValidateBtn.textContent = 'Save & Validate Keys';
      if (res?.ok) {
        await renderApiKeyPanel();
        showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> All API keys cleared from vault');
      } else {
        showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> ' + (res?.error || 'Save failed'), true);
      }
      return;
    }

    saveValidateBtn.textContent = '⏳';
    saveValidateBtn.disabled = true;

    const gStats = await validateRowsForProvider(
      'groq-keys-list',
      'input.pm-groq-input',
      'groq'
    );
    setProviderStatIds('groq', {
      total: gStats.total,
      active: gStats.active,
      invalid: gStats.invalid
    });

    const mStats = await validateRowsForProvider(
      'gemini-keys-list',
      'input.pm-gemini-input',
      'gemini'
    );
    setProviderStatIds('gemini', {
      total: mStats.total,
      active: mStats.active,
      invalid: mStats.invalid
    });

    if (gStats.hadError || mStats.hadError) {
      saveValidateBtn.textContent = 'Save & Validate Keys';
      saveValidateBtn.disabled = false;
      showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> Fix invalid keys (see rows) before saving.', true);
      return;
    }

    const groqKeys = [...new Set(groqFlat)];
    const geminiKeys = [...new Set(gemFlat)];

    const res = await chrome.runtime.sendMessage({
      type: 'SAVE_API_KEY_QUEUES',
      groq: groqKeys,
      gemini: geminiKeys
    });

    saveValidateBtn.textContent = 'Save & Validate Keys';
    saveValidateBtn.disabled = false;

    if (res?.ok) {
      await renderApiKeyPanel();
      document.querySelectorAll('#groq-keys-list .key-adv-row').forEach((row) => {
        const inp = row.querySelector('input.pm-groq-input');
        if (inp && String(inp.value).trim()) setRowValidationUI(row, 'ok');
      });
      document.querySelectorAll('#gemini-keys-list .key-adv-row').forEach((row) => {
        const inp = row.querySelector('input.pm-gemini-input');
        if (inp && String(inp.value).trim()) setRowValidationUI(row, 'ok');
      });
      refreshKeyDashboards();
      showToast(
        '<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Keys saved: ' +
          groqKeys.length +
          ' Groq' +
          (geminiKeys.length ? ', ' + geminiKeys.length + ' Gemini' : '')
      );
    } else {
      showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> ' + (res?.error || 'Save failed'), true);
    }
  });
}

const clearKeysBtn = document.getElementById('clear-keys-btn');
if (clearKeysBtn) {
  clearKeysBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_API_KEYS' });
    await renderApiKeyPanel();
    showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg> All API keys cleared');
  });
}

async function checkServerStatus() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (!dot || !txt) return;

  dot.className = 'checking';
  txt.textContent = 'Connecting...';

  try {
    const r = await chrome.runtime.sendMessage({ type: 'GET_REMAINING' });

    if (r?.reset) {
      updateRemaining(10, 10);
      showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg> Daily limit reset!');
    } else {
      updateRemaining(r?.remaining ?? 10, r?.total || 10);
    }

    dot.className = 'online';
    txt.innerHTML =
      r?.system === 'a' ? 'Own API Key Active <svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>' : 'Server Connected <svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>';

    const limSt = await chrome.storage.local.get([
      'pm_is_pro',
      'pm_system',
      'pm_remaining',
      'pm_daily_limit',
      'pm_total',
      'pm_last_generate_ts',
      'pm_last_quota_sync'
    ]);
    applyQuotaBarsFromStorage(limSt);
    updateRemainingCardLabel(limSt);
    updateGenerationLimitState(limSt);
    void _refreshRemainingUI();
  } catch {
    dot.className = 'offline';
    txt.textContent = 'Connection Error';
  }
}

function updateRemaining(remaining, total) {
  const remEl = document.getElementById('remaining-count');
  const usedEl = document.getElementById('used-count');
  const totEl = document.getElementById('total-count');
  const bar = document.getElementById('remaining-bar');

  const t = total || 10;

  if (remEl) remEl.textContent = String(remaining);
  if (usedEl) usedEl.textContent = String(Math.max(0, t - remaining));
  if (totEl) totEl.textContent = String(t);

  const pct = Math.min(100, (remaining / t) * 100);
  if (bar) {
    bar.style.width = pct + '%';
    bar.classList.toggle('low', pct <= 30);
  }
}

const copyClientId = document.getElementById('copy-client-id');
if (copyClientId) {
  copyClientId.addEventListener('click', async () => {
    const id = document.getElementById('client-id-val')?.textContent?.trim();
    if (!id || id === 'Generating...') return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Client ID copied!');
  });
}

async function renderHistory() {
  const container = document.getElementById('history-container');
  if (!container) return;

  await _midnightHistoryDateRoll();

  let { prompt_history: history = [] } = await chrome.storage.local.get(
    'prompt_history'
  );
  const capRes = await chrome.runtime
    .sendMessage({ type: 'GET_HISTORY_MAX' })
    .catch(() => ({ max: 1000 }));
  const histCap =
    typeof capRes?.max === 'number' && capRes.max > 0 ? capRes.max : 1000;
  if (Array.isArray(history) && history.length > histCap) {
    history = history.slice(-histCap);
    await chrome.storage.local.set({ prompt_history: history });
  }

  const { pm_is_pro: _histIsPro } = await chrome.storage.local.get('pm_is_pro');

  const csvOk = await resolveCsvExportAllowed();
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    const canExport = history.length > 0 && csvOk;
    exportBtn.disabled = !csvOk;
    exportBtn.style.opacity = canExport ? '1' : csvOk && history.length ? '0.5' : '0.35';
    exportBtn.style.cursor = csvOk ? 'pointer' : 'not-allowed';
    exportBtn.title = csvOk
      ? history.length
        ? ''
        : 'Generate prompts to export CSV'
      : 'CSV export requires a paid plan — upgrade at Settings';
  }

  if (!history.length) {
    container.innerHTML = `<div class="hist-empty">
      <div class="ei" aria-hidden="true"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>
      No prompts yet. Generate a prompt to see it here.
    </div>`;
    await updateHistoryCountBadge();
    return;
  }

  const list = document.createElement('div');
  list.className = 'hist-list';

  [...history].reverse().forEach((item, i) => {
    const realIdx = history.length - 1 - i;
    const card = document.createElement('div');
    card.className = 'hist-card';
    card.innerHTML = `
      <div class="hc-meta">
        <span class="hc-style ${item.style || 'universal'}">${item.style || 'universal'}</span>
        <span class="hc-time">${formatTime(item.ts)}</span>
      </div>
      <div class="hc-text">${escHtml(item.prompt)}</div>
      <div class="hc-btns">
        <button type="button" class="hb cp"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/></svg> Copy</button>
        <button type="button" class="hb dl"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg> Delete</button>
      </div>`;

    // Free user: add transparent overlay that blocks all interaction → upgrade modal
    if (!_histIsPro) {
      card.classList.add('locked');
      const _overlay = document.createElement('div');
      _overlay.className = 'hc-lock-overlay';
      _overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        showUpgradeModal();
      });
      card.appendChild(_overlay);
    }

    card.querySelector('.cp').onclick = async () => {
      if (!(await ensureProAccess())) {
        showUpgradeModal();
        return;
      }
      try {
        await navigator.clipboard.writeText(item.prompt);
      } catch {
        const t = document.createElement('textarea');
        t.value = item.prompt;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        t.remove();
      }
      showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Copied!');
    };

    card.querySelector('.dl').onclick = async () => {
      if (!(await ensureProAccess())) {
        showUpgradeModal();
        return;
      }
      const { prompt_history: h = [] } = await chrome.storage.local.get(
        'prompt_history'
      );
      h.splice(realIdx, 1);
      await chrome.storage.local.set({ prompt_history: h });
      await renderHistory();
    };

    list.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(list);
  await updateHistoryCountBadge();
}

const clearHistBtn = document.getElementById('clear-history');
if (clearHistBtn) {
  clearHistBtn.addEventListener('click', async () => {
    if (!(await ensureProAccess())) {
      showUpgradeModal();
      return;
    }
    _showClearAllConfirm();
  });
}

const exportCsvBtn = document.getElementById('export-csv-btn');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', async () => {
    if (!(await ensureProAccess())) {
      showUpgradeModal();
      return;
    }
    if (exportCsvBtn.disabled) return;
    await exportHistoryCSV();
  });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return d.toLocaleDateString();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(msg, err) {
  const t = toastEl();
  if (!t) return;
  t.innerHTML = msg;
  t.style.color = err ? '#f87171' : '#34d399';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function showUpgradeModal() {
  const overlay = document.getElementById('upgrade-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
}
function _closeUpgradeModal() {
  const overlay = document.getElementById('upgrade-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

let _clearConfirmSource = 'csv';

function _showCsvClearConfirm(exportedCount) {
  const overlay = document.getElementById('csv-confirm-overlay');
  if (!overlay) {
    // Fallback if dialog not found in DOM
    showToast(`<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Exported ${exportedCount} prompt${exportedCount !== 1 ? 's' : ''}`);
    return;
  }
  _clearConfirmSource = 'csv';
  const icon = document.getElementById('csv-confirm-icon');
  if (icon) icon.innerHTML = '<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>';
  const title = document.getElementById('csv-confirm-title');
  if (title) title.textContent = 'Downloaded! Clear History?';
  const sub = document.getElementById('csv-confirm-sub');
  if (sub) {
    sub.innerHTML = `<strong style="color:#34d399">${exportedCount} prompt${exportedCount !== 1 ? 's' : ''}</strong> exported to CSV.<br>Do you want to clear your history now?`;
  }
  overlay.classList.add('open');
}

function _showClearAllConfirm() {
  const overlay = document.getElementById('csv-confirm-overlay');
  if (!overlay) return;
  _clearConfirmSource = 'clearAll';
  const icon = document.getElementById('csv-confirm-icon');
  if (icon) icon.innerHTML = '<svg style="display:inline-block;vertical-align:-0.15em;color:#f87171" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>';
  const title = document.getElementById('csv-confirm-title');
  if (title) title.textContent = 'Clear All History?';
  const sub = document.getElementById('csv-confirm-sub');
  if (sub) sub.innerHTML = 'This will permanently delete all your saved prompts.<br>This cannot be undone.';
  overlay.classList.add('open');
}

function _closeCsvConfirm() {
  const overlay = document.getElementById('csv-confirm-overlay');
  if (overlay) overlay.classList.remove('open');
}

async function ensureProAccess() {
  if (_verifiedPro === true) return true;
  const { pm_activated_email } = await chrome.storage.local.get('pm_activated_email');
  if (!pm_activated_email) return false;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SYNC_SUBSCRIPTION' }).catch(() => null);
    if (result && result.synced === true) {
      _verifiedPro = true;
      return true;
    }
  } catch (_) {}
  _verifiedPro = false;
  return false;
}

function _showTamperLockScreen() {
  const el = document.getElementById("tamper-lock-screen");
  if (el) el.remove();
  const wrap = document.querySelector(".wrap");
  if (wrap) wrap.style.display = "block";
}
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('upm-close-btn');
  const laterBtn = document.getElementById('upm-later-btn');
  const upgradeBtn = document.getElementById('upm-upgrade-btn');
  const overlay = document.getElementById('upgrade-modal-overlay');
  if (closeBtn) closeBtn.addEventListener('click', _closeUpgradeModal);
  if (laterBtn) laterBtn.addEventListener('click', _closeUpgradeModal);
  if (upgradeBtn) upgradeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: '#' });
    _closeUpgradeModal();
  });
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) _closeUpgradeModal();
  });

  // CSV Clear Confirm dialog
  const csvYesBtn = document.getElementById('csv-confirm-yes-btn');
  const csvKeepBtn = document.getElementById('csv-confirm-keep-btn');
  const csvOverlay = document.getElementById('csv-confirm-overlay');
  if (csvYesBtn) {
    csvYesBtn.addEventListener('click', async () => {
      _closeCsvConfirm();
      await chrome.storage.local.set({ prompt_history: [] });
      await renderHistory();
      await updateHistoryCountBadge();
      await patchHistoryCsvButtonState();
      showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg> History cleared');
    });
  }
  if (csvKeepBtn) {
    csvKeepBtn.addEventListener('click', () => {
      _closeCsvConfirm();
      if (_clearConfirmSource === 'clearAll') {
        showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> History kept');
      } else {
        showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> CSV saved — history kept');
      }
    });
  }
  if (csvOverlay) {
    csvOverlay.addEventListener('click', (e) => {
      if (e.target === csvOverlay) _closeCsvConfirm();
    });
  }

  // Welcome screen buttons
  document.getElementById('wlc-start-btn')?.addEventListener('click', async () => {
    await chrome.storage.local.set({ pm_welcome_shown: true });
    document.getElementById('welcome-overlay')?.classList.remove('open');
  });
  document.getElementById('wlc-activate-link')?.addEventListener('click', async () => {
    await chrome.storage.local.set({ pm_welcome_shown: true });
    document.getElementById('welcome-overlay')?.classList.remove('open');
    document.querySelector('[data-pg="settings"]')?.click();
  });

  // Limit nudge dismiss
  document.getElementById('nudge-dismiss-btn')?.addEventListener('click', async () => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    await chrome.storage.local.set({ pm_nudge_dismissed: todayStr });
    document.getElementById('limit-nudge')?.classList.remove('show');
  });
});

async function getLatestPromptForAiOpen() {
  const { prompt_history: history = [] } = await chrome.storage.local.get('prompt_history');
  if (!Array.isArray(history) || !history.length) return '';
  const last = history[history.length - 1];
  const prompt = String(last?.prompt || '')
    .replace(/^\/imagine\s*/i, '')
    .trim();
  return prompt;
}

async function copyTextSafe(text) {
  const v = String(text || '');
  if (!v) return false;
  try {
    await navigator.clipboard.writeText(v);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = v;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

const OPEN_AI_TOOL_URLS = {
  midjourney: 'https://www.midjourney.com/imagine',
  bing: 'https://www.bing.com/images/create',
  stableDiffusion: 'https://clipdrop.co/stable-diffusion',
  flux: 'https://fal.ai/models/fal-ai/flux/schnell',
  ideogram: 'https://ideogram.ai/',
  firefly: 'https://firefly.adobe.com/generate/text-to-image',
  leonardo: 'https://app.leonardo.ai/ai-generations',
  googleflow: 'https://labs.google/fx/tools/flow'
};

const openAiGrid = document.querySelector('#pg-openai .ai-grid');
if (openAiGrid) {
  openAiGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('.ai-btn');
    if (!btn || !openAiGrid.contains(btn)) return;
    e.preventDefault();

    const toolKey = btn.getAttribute('data-tool-key') || '';
    const toolName = btn.getAttribute('data-tool') || 'Tool';
    const targetUrl = OPEN_AI_TOOL_URLS[toolKey];
    if (!targetUrl) return;

    const lastGeneratedPrompt = await getLatestPromptForAiOpen();
    if (!lastGeneratedPrompt) {
      showToast('Please generate a prompt first!', true);
      return;
    }

    const copied = await copyTextSafe(lastGeneratedPrompt);
    if (!copied) {
      showToast('Could not copy prompt. Please copy manually.', true);
      return;
    }

    showToast(`Prompt copied to clipboard! Opening ${toolName}...`);
    chrome.tabs.create({ url: targetUrl });
  });
}

async function exportHistoryCSV() {
  if (!(await resolveCsvExportAllowed())) {
    showToast(
      'Upgrade to Silver (own key) or Golden (our server) for CSV export.',
      true
    );
    return;
  }

  const { prompt_history: history = [] } = await chrome.storage.local.get(
    'prompt_history'
  );

  if (!history.length) {
    showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg> No prompts to export', true);
    return;
  }

  const historySnapshot = history
    .filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const p = item.prompt;
      if (typeof p !== 'string' || !p.trim()) return false;
      if (item.exportBlocked === true) return false;
      return true;
    })
    .map((item) => ({
      style: item.style,
      prompt: item.prompt,
      ts: item.ts
    }));

  if (!historySnapshot.length) {
    showToast('<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg> No exportable prompts in your history.', true);
    return;
  }

  const rows = [['Style', 'Prompt', 'Time']];

  historySnapshot.forEach((item) => {
    const style = item.style || 'universal';
    const prompt = String(item.prompt || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n/g, ' ')
      .replace(/"/g, '""');
    const time = item.ts
      ? new Date(item.ts).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      : '';
    rows.push([style, `"${prompt}"`, time]);
  });

  const csvContent = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const today = new Date().toLocaleDateString('en-CA');

  const a = document.createElement('a');
  a.href = url;
  a.download = `VisionPrompt-history-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const exportedCount = historySnapshot.length;
  // Revoke the object URL after browser has had time to start the download
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }, 500);
  // Ask user whether to clear history instead of auto-clearing
  _showCsvClearConfirm(exportedCount);
}
