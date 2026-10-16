(() => {
  "use strict";

  const PAGE_SIZE = 100;
  const STORAGE = {
    timer: "devchart.timer.v2",
    recipe: "devchart.recipe.v2",
    history: "devchart.history.v2",
    checklist: "devchart.checklist.v2",
    fixer: "devchart.fixer.v1",
    tank: "devchart.tank.v1",
    logs: "devchart.logs.v1"
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const value = input => String(input ?? "").trim();
  const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
  const localeCompare = (a, b) => value(a).localeCompare(value(b), "zh-CN", { numeric: true, sensitivity: "base" });
  const safeJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };

  const fields = {
    keyword: $("#keyword"), film: $("#film-filter"), developer: $("#developer-filter"),
    iso: $("#iso-filter"), format: $("#format-filter"), temp: $("#temp-filter"), sort: $("#sort-filter")
  };
  const elements = {
    total: $("#total-count"), summary: $("#result-summary"), loading: $("#loading-state"),
    error: $("#error-state"), errorMessage: $("#error-message"), empty: $("#empty-state"),
    table: $("#table-shell"), body: $("#result-body"), pagination: $("#pagination"),
    previous: $("#previous-page"), next: $("#next-page"), pageStatus: $("#page-status"),
    generatedAt: $("#generated-at"), clear: $("#clear-button"), toast: $("#toast")
  };

  let charts = [];
  let filtered = [];
  let page = 1;
  let sourceUrl = "https://www.digitaltruth.com/devchart.php";
  let toastTimeout;

  function showToast(message, duration = 2800) {
    clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimeout = setTimeout(() => { elements.toast.hidden = true; }, duration);
  }

  function currentRoute() {
    const route = location.hash.replace(/^#/, "");
    return ["recipes", "timer", "chemistry", "tools"].includes(route) ? route : "recipes";
  }

  function navigate(route, scroll = true) {
    if (!["recipes", "timer", "chemistry", "tools"].includes(route)) route = "recipes";
    $$("[data-view]").forEach(view => {
      const active = view.dataset.view === route;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    $$(".nav-item[data-route]").forEach(button => {
      const active = button.dataset.route === route;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    if (location.hash !== `#${route}`) history.pushState(null, "", `${location.pathname}${location.search}#${route}`);
    if (scroll) window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function initRouting() {
    $$(".nav-item[data-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.route)));
    window.addEventListener("hashchange", () => navigate(currentRoute(), false));
    navigate(currentRoute(), false);
  }

  async function loadData() {
    try {
      const response = await fetch("data/charts.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const compact = payload?.v === 2 && Array.isArray(payload.c);
      const rows = compact ? payload.c : (Array.isArray(payload) ? payload : payload.charts);
      if (!Array.isArray(rows)) throw new Error("charts.json 格式不正确");
      sourceUrl = value(compact ? payload.s : payload.source) || sourceUrl;
      charts = rows.map((row, index) => compact ? {
        id: index, FilmName: value(payload.f?.[row[0]]), DeveloperName: value(payload.d?.[row[1]]),
        Dilution: value(payload.l?.[row[2]]), ISO: value(payload.i?.[row[3]]), Film35: value(payload.m?.[row[4]]),
        Film120: value(payload.m?.[row[5]]), Sheet: value(payload.m?.[row[6]]), Temp: value(payload.t?.[row[7]]),
        NotesUrl: typeof row[8] === "number" ? (row[8] ? `https://www.digitaltruth.com/devchart.php?devrow=${row[8]}` : "") : value(row[8])
      } : {
        id: index, FilmName: value(row.FilmName), DeveloperName: value(row.DeveloperName),
        Dilution: value(row.Dilution), ISO: value(row.ISO), Film35: value(row.Film35),
        Film120: value(row.Film120), Sheet: value(row.Sheet), Temp: value(row.Temp), NotesUrl: value(row.NotesUrl)
      });
      elements.total.textContent = charts.length.toLocaleString("zh-CN");
      elements.generatedAt.textContent = formatDate(compact ? payload.g : payload.generatedAt);
      fillSelect(fields.film, unique("FilmName"));
      fillSelect(fields.developer, unique("DeveloperName"));
      fillSelect(fields.iso, unique("ISO"));
      fillSelect(fields.temp, unique("Temp"));
      restoreSearchState();
      bindSearchEvents();
      applyFilters();
      elements.loading.hidden = true;
    } catch (error) {
      elements.loading.hidden = true;
      elements.error.hidden = false;
      elements.errorMessage.textContent = location.protocol === "file:"
        ? "浏览器禁止从 file:// 读取 JSON。请启动本地 HTTP 服务后再打开页面。"
        : `请确认 data/charts.json 已生成且可访问（${error.message}）。`;
      elements.summary.textContent = "加载失败";
    }
  }

  function unique(key) { return [...new Set(charts.map(row => row[key]).filter(Boolean))].sort(localeCompare); }
  function fillSelect(select, values) {
    const fragment = document.createDocumentFragment();
    values.forEach(item => { const option = document.createElement("option"); option.value = item; option.textContent = item; fragment.append(option); });
    select.append(fragment);
  }

  function bindSearchEvents() {
    let debounce;
    fields.keyword.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(() => { page = 1; applyFilters(); }, 120); });
    Object.entries(fields).filter(([key]) => key !== "keyword").forEach(([, control]) => control.addEventListener("change", () => { page = 1; applyFilters(); }));
    elements.clear.addEventListener("click", clearFilters);
    elements.previous.addEventListener("click", () => changePage(page - 1));
    elements.next.addEventListener("click", () => changePage(page + 1));
    elements.body.addEventListener("click", event => {
      const button = event.target.closest(".time-button");
      if (!button) return;
      const row = charts[Number(button.dataset.row)];
      useRecipeTime(row, button.dataset.format, button.dataset.time);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { event.preventDefault(); navigate("recipes"); fields.keyword.focus(); }
      if (event.key === "Escape" && document.activeElement === fields.keyword) { fields.keyword.value = ""; page = 1; applyFilters(); }
    });
  }

  function applyFilters() {
    const tokens = fields.keyword.value.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const selected = { film: fields.film.value, developer: fields.developer.value, iso: fields.iso.value, format: fields.format.value, temp: fields.temp.value };
    filtered = charts.filter(row => {
      if (selected.film && row.FilmName !== selected.film) return false;
      if (selected.developer && row.DeveloperName !== selected.developer) return false;
      if (selected.iso && row.ISO !== selected.iso) return false;
      if (selected.temp && row.Temp !== selected.temp) return false;
      if (selected.format && !row[selected.format]) return false;
      if (!tokens.length) return true;
      const haystack = [row.FilmName, row.DeveloperName, row.Dilution, row.ISO, row.Film35, row.Film120, row.Sheet, row.Temp].join(" ").toLocaleLowerCase();
      return tokens.every(token => haystack.includes(token));
    });
    const sorters = {
      film: (a, b) => localeCompare(a.FilmName, b.FilmName) || localeCompare(a.DeveloperName, b.DeveloperName) || localeCompare(a.ISO, b.ISO),
      developer: (a, b) => localeCompare(a.DeveloperName, b.DeveloperName) || localeCompare(a.FilmName, b.FilmName) || localeCompare(a.ISO, b.ISO),
      iso: (a, b) => (Number.parseFloat(a.ISO) || Number.MAX_VALUE) - (Number.parseFloat(b.ISO) || Number.MAX_VALUE) || localeCompare(a.FilmName, b.FilmName)
    };
    filtered.sort(sorters[fields.sort.value] || sorters.film);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, pages);
    renderResults(pages);
    saveSearchState();
  }

  function renderResults(pages) {
    elements.body.replaceChildren();
    const start = (page - 1) * PAGE_SIZE;
    const fragment = document.createDocumentFragment();
    filtered.slice(start, start + PAGE_SIZE).forEach(row => fragment.append(renderRow(row)));
    elements.body.append(fragment);
    elements.empty.hidden = filtered.length !== 0;
    elements.table.hidden = filtered.length === 0;
    elements.pagination.hidden = filtered.length === 0 || pages === 1;
    elements.previous.disabled = page <= 1; elements.next.disabled = page >= pages;
    elements.pageStatus.textContent = `${page} / ${pages}`;
    elements.summary.textContent = filtered.length ? `找到 ${filtered.length.toLocaleString("zh-CN")} 条 · 显示 ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)}` : "0 条结果";
  }

  function renderRow(row) {
    const tr = document.createElement("tr");
    [["胶片", row.FilmName, ""], ["显影液", row.DeveloperName, ""], ["稀释", row.Dilution, ""], ["ISO", row.ISO, ""], ["35mm", row.Film35, "Film35"], ["120", row.Film120, "Film120"], ["页片", row.Sheet, "Sheet"], ["温度", row.Temp, ""]].forEach(([label, content, format]) => {
      const td = document.createElement("td"); td.dataset.label = label;
      const seconds = format ? parseDuration(content) : null;
      if (format && seconds) {
        const button = document.createElement("button"); button.type = "button"; button.className = "time-button"; button.textContent = content;
        button.dataset.row = String(row.id); button.dataset.format = format; button.dataset.time = content;
        button.title = `将 ${content} 带入显影计时器`;
        td.append(button);
      } else td.textContent = content;
      tr.append(td);
    });
    const notes = document.createElement("td"); notes.dataset.label = "备注";
    const href = safeNoteUrl(row.NotesUrl);
    if (href) { const link = document.createElement("a"); link.className = "note-link"; link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "NOTES"; link.setAttribute("aria-label", `${row.FilmName} / ${row.DeveloperName} 的备注`); notes.append(link); }
    tr.append(notes); return tr;
  }

  function safeNoteUrl(raw) {
    if (!raw) return "";
    let candidate = raw;
    if (raw.includes("<")) candidate = new DOMParser().parseFromString(raw, "text/html").querySelector("a")?.getAttribute("href") || "";
    try { const url = new URL(candidate, sourceUrl); return url.protocol === "https:" && /(^|\.)digitaltruth\.com$/i.test(url.hostname) ? url.href : ""; } catch { return ""; }
  }

  function clearFilters() { Object.values(fields).forEach(control => { control.value = control === fields.sort ? "film" : ""; }); page = 1; applyFilters(); fields.keyword.focus(); }
  function changePage(nextPage) { const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); page = clamp(nextPage, 1, pages); renderResults(pages); saveSearchState(); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); }
  function saveSearchState() {
    const params = new URLSearchParams();
    Object.entries(fields).forEach(([key, control]) => { if (control.value && !(key === "sort" && control.value === "film")) params.set(key, control.value); });
    if (page > 1) params.set("page", String(page));
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}#${currentRoute()}`);
  }
  function restoreSearchState() {
    const params = new URLSearchParams(location.search);
    Object.entries(fields).forEach(([key, control]) => {
      const restored = params.get(key);
      if (!restored) return;
      const isSelect = control.tagName === "SELECT";
      const hasOption = !isSelect || Array.prototype.some.call(control.options, option => option.value === restored);
      if (hasOption) control.value = restored;
    });
    page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
  }

  function parseDuration(input) {
    const raw = value(input).replace(/[′’]/g, "").replace(/min(?:utes?)?/i, "").trim();
    if (!raw || !/[0-9]/.test(raw)) return null;
    if (raw.includes("+")) {
      const parts = raw.split("+").map(parseSingleDuration);
      return parts.length > 1 && parts.every(Number.isFinite) ? parts.reduce((sum, part) => sum + part, 0) : null;
    }
    if (raw.includes("-")) {
      const pair = raw.split("-").map(parseSingleDuration).filter(Number.isFinite);
      return pair.length === 2 ? Math.round((pair[0] + pair[1]) / 2) : null;
    }
    return parseSingleDuration(raw);
  }
  function parseSingleDuration(raw) {
    const text = value(raw);
    if (/^\d+:\d{1,2}$/.test(text)) { const [minutes, seconds] = text.split(":").map(Number); return minutes * 60 + seconds; }
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text) * 60);
    return null;
  }
  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function formatVolume(number) { return Number(number).toLocaleString("zh-CN", { maximumFractionDigits: number < 10 ? 2 : 1 }); }
  function formatDate(input) { const date = new Date(input); return Number.isNaN(date.getTime()) ? "未知" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date); }

  const timer = {
    labels: ["显影", "停影", "定影"], current: 0, running: false, remaining: 540, endAt: 0,
    intervalId: null, wakeLock: null, audio: null, lastAgitation: -1, awaitingAdvance: false,
    recipe: safeJson(STORAGE.recipe, null)
  };
  const stageCards = $$(".stage-card");

  function stageSeconds(index) {
    const card = stageCards[index];
    return clamp(Number(card.querySelector(".stage-minutes").value) || 0, 0, 180) * 60 + clamp(Number(card.querySelector(".stage-seconds").value) || 0, 0, 59);
  }
  function updateTimerSettings() {
    const settings = stageCards.map(card => ({ minutes: Number(card.querySelector(".stage-minutes").value) || 0, seconds: Number(card.querySelector(".stage-seconds").value) || 0 }));
    localStorage.setItem(STORAGE.timer, JSON.stringify({ stages: settings, initial: Number($("#initial-agitation").value) || 0, interval: Number($("#agitation-interval").value) || 0 }));
    $("#total-duration").textContent = `总计 ${formatDuration(stageCards.reduce((sum, _, index) => sum + stageSeconds(index), 0))}`;
    if (!timer.running) { timer.remaining = stageSeconds(timer.current); updateTimerDisplay(); }
  }
  function restoreTimerSettings() {
    const saved = safeJson(STORAGE.timer, null);
    if (saved?.stages?.length === 3) saved.stages.forEach((stage, index) => { stageCards[index].querySelector(".stage-minutes").value = clamp(Number(stage.minutes) || 0, 0, 180); stageCards[index].querySelector(".stage-seconds").value = clamp(Number(stage.seconds) || 0, 0, 59); });
    if (saved) { $("#initial-agitation").value = clamp(Number(saved.initial) || 0, 0, 120); $("#agitation-interval").value = clamp(Number(saved.interval) || 0, 0, 300); }
    if (timer.recipe) renderTimerRecipe();
    updateTimerSettings();
  }
  function selectStage(index) {
    if (timer.running) pauseTimer();
    hideStageAlert();
    timer.current = clamp(index, 0, 2); timer.remaining = stageSeconds(timer.current); timer.lastAgitation = -1;
    stageCards.forEach((card, cardIndex) => card.classList.toggle("is-current", cardIndex === timer.current));
    updateTimerDisplay();
  }
  function updateTimerDisplay() {
    const total = stageSeconds(timer.current) || 1;
    const progress = clamp(timer.remaining / total, 0, 1);
    $("#timer-display").textContent = formatDuration(timer.remaining);
    $("#timer-stage-label").textContent = timer.labels[timer.current];
    $("#timer-progress").style.strokeDashoffset = String(100 - progress * 100);
    $("#timer-toggle").textContent = timer.running ? "暂停" : (timer.remaining <= 0 && timer.current === 2 ? "重新开始" : (timer.remaining < total ? "继续" : "开始"));
    document.title = timer.running ? `${formatDuration(timer.remaining)} · ${timer.labels[timer.current]} · DevChart` : "DevChart · 暗房工作台";
  }
  function ensureAudio() { if (!timer.audio) timer.audio = new (window.AudioContext || window.webkitAudioContext)(); if (timer.audio.state === "suspended") timer.audio.resume(); }
  function beep(frequency = 880, duration = .12, count = 1) {
    try {
      ensureAudio();
      const urgent = count >= 3;
      for (let index = 0; index < count; index += 1) {
        const oscillator = timer.audio.createOscillator(); const gain = timer.audio.createGain(); const start = timer.audio.currentTime + index * (duration + (urgent ? .035 : .06));
        oscillator.type = urgent ? "square" : "sine";
        oscillator.frequency.value = urgent && index % 2 ? frequency * 1.42 : frequency;
        gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(urgent ? .28 : .17, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(gain).connect(timer.audio.destination); oscillator.start(start); oscillator.stop(start + duration + .02);
      }
    } catch { /* audio is optional */ }
    navigator.vibrate?.(count >= 3 ? Array.from({ length: count * 2 - 1 }, (_, index) => index % 2 ? 55 : 180) : (count === 2 ? [120, 55, 120] : 100));
  }
  async function requestWakeLock() { if (!$("#keep-awake").checked || !navigator.wakeLock) return; try { timer.wakeLock = await navigator.wakeLock.request("screen"); } catch { showToast("浏览器未允许屏幕常亮，计时仍会继续"); } }
  async function releaseWakeLock() { try { await timer.wakeLock?.release(); } catch { /* no-op */ } timer.wakeLock = null; }
  function startTimer() {
    if (stageSeconds(timer.current) <= 0) { showToast("请先设置当前阶段的时间"); return; }
    if (timer.remaining <= 0) {
      if (timer.current === 2) resetTimer();
      else timer.remaining = stageSeconds(timer.current);
    }
    ensureAudio(); timer.running = true; timer.endAt = Date.now() + timer.remaining * 1000; timer.lastAgitation = -1;
    $("#timer-status").textContent = "计时中"; clearInterval(timer.intervalId); timer.intervalId = setInterval(tickTimer, 200); requestWakeLock(); tickTimer();
  }
  function pauseTimer() { timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000)); timer.running = false; clearInterval(timer.intervalId); $("#timer-status").textContent = "已暂停"; releaseWakeLock(); updateTimerDisplay(); }
  function tickTimer() {
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    if (timer.current === 0) checkAgitation();
    updateTimerDisplay();
    if (timer.remaining <= 0) completeStage();
  }
  function checkAgitation() {
    const elapsed = stageSeconds(0) - timer.remaining;
    const initial = clamp(Number($("#initial-agitation").value) || 0, 0, 120);
    const interval = clamp(Number($("#agitation-interval").value) || 0, 0, 300);
    if (!interval || elapsed < initial) return;
    const marker = Math.floor((elapsed - initial) / interval);
    if (marker > timer.lastAgitation) { timer.lastAgitation = marker; if (elapsed > 0) { beep(1120, .1, 4); showToast("搅动提醒：请立即搅动", 2200); } }
  }
  function completeStage() {
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.remaining = 0;
    timer.awaitingAdvance = true;
    $("#timer-status").textContent = `${timer.labels[timer.current]}结束，等待继续`;
    updateTimerDisplay();
    beep(820, .14, 8);
    showStageAlert();
  }
  function showStageAlert() {
    const finalStage = timer.current === timer.labels.length - 1;
    $("#stage-alert-title").textContent = `${timer.labels[timer.current]}结束`;
    $("#stage-alert-message").textContent = finalStage ? "三段计时已经完成，点击继续结束本次冲洗" : `请更换药液，准备进入${timer.labels[timer.current + 1]}`;
    $("#stage-alert").hidden = false;
    $("#stage-continue").focus();
  }
  function hideStageAlert() { timer.awaitingAdvance = false; $("#stage-alert").hidden = true; }
  function continueStage() {
    if (!timer.awaitingAdvance) return;
    hideStageAlert();
    if (timer.current >= timer.labels.length - 1) { finishTimer(); return; }
    timer.current += 1;
    timer.remaining = stageSeconds(timer.current);
    timer.lastAgitation = -1;
    stageCards.forEach((card, index) => card.classList.toggle("is-current", index === timer.current));
    $("#timer-status").textContent = `${timer.labels[timer.current]}开始`;
    showToast(`${timer.labels[timer.current]}开始`);
    startTimer();
  }
  function finishTimer() { timer.running = false; timer.remaining = 0; $("#timer-status").textContent = "全部完成"; releaseWakeLock(); updateTimerDisplay(); addHistory(); showToast("三段冲洗计时完成", 4000); }
  function resetTimer() { clearInterval(timer.intervalId); hideStageAlert(); timer.running = false; timer.current = 0; timer.remaining = stageSeconds(0); timer.lastAgitation = -1; stageCards.forEach((card, index) => card.classList.toggle("is-current", index === 0)); $("#timer-status").textContent = "准备就绪"; releaseWakeLock(); updateTimerDisplay(); }
  function skipStage() { if (timer.running || timer.remaining < stageSeconds(timer.current)) { timer.remaining = 0; completeStage(); } else if (timer.current < 2) selectStage(timer.current + 1); else resetTimer(); }
  function useRecipeTime(row, format, rawTime) {
    const seconds = parseDuration(rawTime); if (!seconds) return;
    resetTimer(); stageCards[0].querySelector(".stage-minutes").value = Math.floor(seconds / 60); stageCards[0].querySelector(".stage-seconds").value = seconds % 60;
    timer.recipe = { film: row.FilmName, developer: row.DeveloperName, dilution: row.Dilution, iso: row.ISO, temp: row.Temp, format: { Film35: "35mm", Film120: "120", Sheet: "页片" }[format], rawTime };
    localStorage.setItem(STORAGE.recipe, JSON.stringify(timer.recipe)); renderTimerRecipe(); updateTimerSettings(); navigate("timer"); showToast(`已带入显影时间 ${rawTime}`);
  }
  function renderTimerRecipe() { if (!timer.recipe) return; $("#timer-recipe").hidden = false; $("#timer-recipe-name").textContent = `${timer.recipe.film} · ${timer.recipe.developer}`; $("#timer-recipe-meta").textContent = `${timer.recipe.dilution || "原液"} / ISO ${timer.recipe.iso} / ${timer.recipe.format} / ${timer.recipe.temp} / ${timer.recipe.rawTime}`; }
  function addHistory() {
    const history = safeJson(STORAGE.history, []);
    history.unshift({ at: new Date().toISOString(), recipe: timer.recipe, stages: stageCards.map((_, index) => stageSeconds(index)) });
    localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 12))); renderHistory();
  }
  function renderHistory() {
    const list = $("#history-list"); const history = safeJson(STORAGE.history, []); list.replaceChildren();
    if (!history.length) { const empty = document.createElement("p"); empty.className = "history-empty"; empty.textContent = "完成一次三段计时后，记录会保存在这台设备上。"; list.append(empty); return; }
    history.forEach(item => { const row = document.createElement("div"); row.className = "history-item"; const text = document.createElement("span"); const title = document.createElement("strong"); title.textContent = item.recipe ? `${item.recipe.film} · ${item.recipe.developer}` : "自定义冲洗"; const meta = document.createElement("small"); meta.textContent = item.recipe ? `${item.recipe.dilution || "原液"} / ISO ${item.recipe.iso}` : "未关联配方"; text.append(title, meta); const stages = document.createElement("span"); stages.className = "mono"; stages.textContent = item.stages.map(formatDuration).join(" / "); const time = document.createElement("time"); time.dateTime = item.at; time.textContent = formatDate(item.at); row.append(text, stages, time); list.append(row); });
  }
  function initTimer() {
    restoreTimerSettings(); renderHistory();
    stageCards.forEach((card, index) => { card.querySelector(".stage-select").addEventListener("click", () => selectStage(index)); card.querySelectorAll("input").forEach(input => input.addEventListener("input", updateTimerSettings)); });
    [$("#initial-agitation"), $("#agitation-interval")].forEach(input => input.addEventListener("input", updateTimerSettings));
    $("#timer-toggle").addEventListener("click", () => timer.running ? pauseTimer() : startTimer()); $("#timer-reset").addEventListener("click", resetTimer); $("#timer-skip").addEventListener("click", skipStage);
    $("#stage-continue").addEventListener("click", continueStage);
    $("#clear-history").addEventListener("click", () => { localStorage.removeItem(STORAGE.history); renderHistory(); showToast("本机冲洗记录已清空"); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && timer.running) { requestWakeLock(); tickTimer(); } });
  }

  function calculateMix() {
    const volume = Number($("#mix-volume").value); const ratioText = $("#mix-ratio").value.trim().replace(/:/g, "+").replace(/\s/g, ""); const result = $("#mix-result"); result.replaceChildren();
    const parts = ratioText.split("+").map(Number);
    if (!(volume > 0) || parts.length < 2 || parts.some(part => !(part > 0))) { result.textContent = "请输入有效的总量和比例，例如 500 mL、1+12。"; result.className = "mix-result message-state"; $("#mix-formula").textContent = ""; return; }
    result.className = "mix-result"; const sum = parts.reduce((total, part) => total + part, 0);
    parts.forEach((part, index) => { const card = document.createElement("div"); card.className = "mix-part"; const label = document.createElement("span"); label.textContent = index === parts.length - 1 ? "清水" : (parts.length === 2 ? "浓缩液" : `${String.fromCharCode(65 + index)} 液`); const amount = document.createElement("strong"); amount.textContent = formatVolume(volume * part / sum); const unit = document.createElement("small"); unit.textContent = "mL"; card.append(label, amount, unit); result.append(card); });
    $("#mix-formula").textContent = `${formatVolume(volume)} mL ÷ ${sum} 份 = ${formatVolume(volume / sum)} mL / 份`;
  }
  function initMixCalculator() {
    [$("#mix-volume"), $("#mix-ratio")].forEach(input => input.addEventListener("input", calculateMix));
    $$('[data-volume]').forEach(button => button.addEventListener("click", () => { $("#mix-volume").value = button.dataset.volume; calculateMix(); }));
    $$('[data-ratio]').forEach(button => button.addEventListener("click", () => { $("#mix-ratio").value = button.dataset.ratio; calculateMix(); })); calculateMix();
  }

  const tempFactors = [[18, 1.25], [19, 1.125], [20, 1], [21, .875], [22, .8125], [24, .6875], [25, .625], [27, .5]];
  function temperatureFactor(temp) {
    if (temp < 18 || temp > 27) return null;
    for (let index = 0; index < tempFactors.length - 1; index += 1) { const [aTemp, aFactor] = tempFactors[index]; const [bTemp, bFactor] = tempFactors[index + 1]; if (temp >= aTemp && temp <= bTemp) return aFactor + (bFactor - aFactor) * ((temp - aTemp) / (bTemp - aTemp)); }
    return tempFactors.at(-1)[1];
  }
  function updateTemperatureTool() {
    const seconds = parseDuration($("#temp-time").value); const from = temperatureFactor(Number($("#temp-from").value)); const to = temperatureFactor(Number($("#temp-to").value));
    $("#temp-result").textContent = seconds && from && to ? formatDuration(Math.round(seconds * to / from / 15) * 15) : "范围 18–27°C";
  }
  function updatePushTool() {
    const seconds = parseDuration($("#push-time").value); const stops = Number($("#push-stops").value); const percent = clamp(Number($("#push-percent").value) || 0, 1, 100) / 100;
    const multiplier = stops >= 0 ? Math.pow(1 + percent, stops) : Math.pow(1 - percent, Math.abs(stops));
    $("#push-result").textContent = seconds ? formatDuration(seconds * multiplier) : "时间格式无效";
  }

  function updateFixerTool(save = true) {
    const clearSeconds = parseDuration($("#fixer-clear-time").value);
    const multiplier = Number($("#fixer-multiplier").value) || 2;
    const volume = Math.max(0, Number($("#fixer-volume").value) || 0);
    const perLitre = Math.max(1, Number($("#fixer-capacity").value) || 24);
    const stored = safeJson(STORAGE.fixer, {});
    const rolls = Math.max(0, Number(stored.rolls) || 0);
    const capacity = Math.max(1, Math.floor(volume / 1000 * perLitre));
    const createdAt = stored.createdAt || null;
    $("#fixer-result").textContent = clearSeconds ? formatDuration(clearSeconds * multiplier) : "时间格式无效";
    $("#fixer-usage").textContent = `已处理 ${rolls} / ${capacity} 卷`;
    $("#fixer-usage").style.color = rolls >= capacity ? "var(--accent)" : "";
    const createdDate = new Date(createdAt);
    if (createdAt && !Number.isNaN(createdDate.getTime())) {
      const days = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));
      $("#fixer-date-label").textContent = `配制于 ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(createdDate)}`;
      $("#fixer-batch-age").textContent = `${days} 天`;
    } else {
      $("#fixer-date-label").textContent = "尚未开始记录";
      $("#fixer-batch-age").textContent = "新批次";
    }
    if (save) localStorage.setItem(STORAGE.fixer, JSON.stringify({ rolls, createdAt, clearTime: $("#fixer-clear-time").value, multiplier, volume, perLitre }));
  }

  function restoreFixerTool() {
    const saved = safeJson(STORAGE.fixer, null);
    if (saved) {
      if (saved.clearTime) $("#fixer-clear-time").value = saved.clearTime;
      if (saved.multiplier) $("#fixer-multiplier").value = String(saved.multiplier);
      if (saved.volume) $("#fixer-volume").value = saved.volume;
      if (saved.perLitre) $("#fixer-capacity").value = saved.perLitre;
    }
    updateFixerTool(false);
  }

  const washSteps = [
    { count: 5, title: "倒转 5 次", message: "装满约 20°C 清水，倒转 5 次后排空。" },
    { count: 10, title: "倒转 10 次", message: "重新装满清水，倒转 10 次后排空。" },
    { count: 20, title: "倒转 20 次", message: "第三次装满清水，倒转 20 次后排空。" }
  ];
  let washStep = 0;
  function showWashStep() {
    const step = washSteps[washStep];
    $("#wash-alert-icon").textContent = String(step.count);
    $("#wash-alert-title").textContent = step.title;
    $("#wash-alert-message").textContent = step.message;
    $("#wash-continue").textContent = washStep === washSteps.length - 1 ? "完成水洗" : "完成并继续";
    $("#wash-alert").hidden = false;
    $("#wash-continue").focus();
  }
  function startWashGuide() { ensureAudio(); washStep = 0; showWashStep(); }
  function continueWashGuide() {
    beep(900, .12, washStep === washSteps.length - 1 ? 6 : 2);
    if (washStep === washSteps.length - 1) { $("#wash-alert").hidden = true; showToast("水洗完成，可以进入润湿与晾干", 4000); return; }
    washStep += 1; showWashStep();
  }

  function updateReciprocityTool() {
    const metered = Math.max(0, Number($("#reciprocity-time").value) || 0);
    const factor = Number($("#reciprocity-film").value) || 1;
    const corrected = metered > 0 ? Math.pow(metered, factor) : 0;
    $("#reciprocity-result").textContent = corrected ? (corrected >= 60 ? formatDuration(corrected) : `${formatVolume(corrected)} 秒`) : "请输入时间";
    $("#reciprocity-formula").textContent = corrected ? `${formatVolume(metered)} ^ ${factor.toFixed(2)} = ${formatVolume(corrected)} 秒` : "一秒及以下通常无需补偿";
  }

  const stripTimer = { targets: [], increments: [], index: 0, remaining: 0, endAt: 0, running: false, intervalId: null };
  function buildStripSequence(resetTimerState = true) {
    const base = Math.max(.1, Number($("#strip-base").value) || 5);
    const step = Number($("#strip-step").value) || .5;
    const count = clamp(Number.parseInt($("#strip-count").value, 10) || 5, 2, 9);
    stripTimer.targets = Array.from({ length: count }, (_, index) => base * Math.pow(2, step * index));
    stripTimer.increments = stripTimer.targets.map((target, index) => index ? target - stripTimer.targets[index - 1] : target);
    $("#strip-sequence").replaceChildren(...stripTimer.targets.map((target, index) => {
      const item = document.createElement("span"); item.className = "strip-step"; item.textContent = `${index + 1} · ${formatVolume(target)}s`; return item;
    }));
    if (resetTimerState) resetStripTimer(false);
  }
  function updateStripDisplay() {
    $$("#strip-sequence .strip-step").forEach((item, index) => item.classList.toggle("is-current", stripTimer.running && index === stripTimer.index));
    $("#strip-timer-display").textContent = stripTimer.running || stripTimer.remaining > 0 ? `${stripTimer.remaining.toFixed(1)} 秒` : "准备";
    $("#strip-toggle").textContent = stripTimer.running ? "暂停" : (stripTimer.remaining > 0 ? "继续" : "开始计时");
  }
  function startStripTimer() {
    if (!stripTimer.targets.length) buildStripSequence();
    ensureAudio();
    if (stripTimer.remaining <= 0) { stripTimer.index = 0; stripTimer.remaining = stripTimer.increments[0]; }
    stripTimer.running = true; stripTimer.endAt = performance.now() + stripTimer.remaining * 1000;
    clearInterval(stripTimer.intervalId); stripTimer.intervalId = setInterval(tickStripTimer, 50);
    $("#strip-status").textContent = stripTimer.index ? `遮住前 ${stripTimer.index} 格，继续曝光` : "第 1 格：保持全部区域曝光";
    tickStripTimer();
  }
  function pauseStripTimer() {
    stripTimer.remaining = Math.max(0, (stripTimer.endAt - performance.now()) / 1000); stripTimer.running = false; clearInterval(stripTimer.intervalId); updateStripDisplay();
  }
  function tickStripTimer() {
    stripTimer.remaining = Math.max(0, (stripTimer.endAt - performance.now()) / 1000); updateStripDisplay();
    if (stripTimer.remaining > 0) return;
    beep(1000, .1, stripTimer.index === stripTimer.targets.length - 1 ? 6 : 2);
    stripTimer.index += 1;
    if (stripTimer.index >= stripTimer.targets.length) { stripTimer.running = false; clearInterval(stripTimer.intervalId); $("#strip-timer-display").textContent = "完成"; $("#strip-status").textContent = "试条曝光完成，可以开始显影。"; $$("#strip-sequence .strip-step").forEach(item => item.classList.remove("is-current")); return; }
    stripTimer.remaining = stripTimer.increments[stripTimer.index]; stripTimer.endAt = performance.now() + stripTimer.remaining * 1000;
    $("#strip-status").textContent = `遮住第 ${stripTimer.index} 格，继续曝光第 ${stripTimer.index + 1} 格`;
  }
  function resetStripTimer(update = true) {
    clearInterval(stripTimer.intervalId); stripTimer.running = false; stripTimer.index = 0; stripTimer.remaining = 0;
    if (update) $("#strip-status").textContent = "按开始后，每声提示遮住下一格。";
    updateStripDisplay();
  }

  const tankDefaults = { "35": 300, "120": 500, sheet: 100 };
  function tankProfiles() { return { ...tankDefaults, ...safeJson(STORAGE.tank, {}) }; }
  function updateTankTool(loadProfile = false) {
    const format = $("#tank-format").value;
    if (loadProfile) $("#tank-unit-volume").value = tankProfiles()[format];
    const unit = Math.max(1, Number($("#tank-unit-volume").value) || 1);
    const count = clamp(Number.parseInt($("#tank-count").value, 10) || 1, 1, 20);
    $("#tank-result").textContent = `${formatVolume(unit * count)} mL`;
  }

  const notchCodes = {
    ortho: { pattern: "边缘  ───────────────╰╯─────", note: "单个窄圆缺口 · ISO 80（日光）/ 40（钨丝灯）" },
    fp4: { pattern: "边缘  ──╰─╯───╰╯──────╰─╯───", note: "三个缺口：宽圆 / 窄圆 / 宽圆 · ISO 125" },
    hp5: { pattern: "边缘  ──╰─╯──────╰╯───╰─╯───", note: "三个缺口：宽圆 / 窄圆 / 宽圆，间距与 FP4 不同 · ISO 400" },
    delta100: { pattern: "边缘  ─╰─╯──╰╯─╰╯───╰─╯─────", note: "四个缺口：宽圆 / 窄圆 / 窄圆 / 宽圆 · ISO 100" }
  };
  function updateNotchTool() { const code = notchCodes[$("#notch-film").value]; $("#notch-pattern").textContent = `${code.pattern}\n（简化触感示意，并非实物比例）`; $("#notch-description").textContent = code.note; }

  function cleanLog(item) {
    return { id: value(item.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: value(item.at) || new Date().toISOString(), film: value(item.film).slice(0, 100), developer: value(item.developer).slice(0, 120), time: value(item.time).slice(0, 30), temp: value(item.temp).slice(0, 20), rating: value(item.rating).slice(0, 30), notes: value(item.notes).slice(0, 300) };
  }
  function getLogs() { const rows = safeJson(STORAGE.logs, []); return Array.isArray(rows) ? rows.map(cleanLog) : []; }
  function saveLogs(rows) { localStorage.setItem(STORAGE.logs, JSON.stringify(rows.slice(0, 200))); renderLogs(); }
  function renderLogs() {
    const rows = getLogs(); const list = $("#log-list"); list.replaceChildren(); $("#log-count").textContent = `${rows.length} 条`;
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "history-empty"; empty.textContent = "记录会保存在当前浏览器，可导出 JSON 或 CSV 备份。"; list.append(empty); return; }
    rows.slice(0, 20).forEach(row => {
      const entry = document.createElement("div"); entry.className = "log-entry";
      const title = document.createElement("span"); const strong = document.createElement("strong"); strong.textContent = row.film || "未命名胶片"; const small = document.createElement("small"); small.textContent = `${row.developer || "未填写显影液"}${row.notes ? ` · ${row.notes}` : ""}`; title.append(strong, small);
      const details = document.createElement("span"); details.className = "mono"; details.textContent = [row.time, row.temp && `${row.temp}°C`].filter(Boolean).join(" / ") || "—";
      const meta = document.createElement("span"); meta.className = "log-rating"; meta.textContent = row.rating || "待观察";
      const time = document.createElement("time"); time.dateTime = row.at; time.textContent = formatDate(row.at);
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "删除"; remove.addEventListener("click", () => saveLogs(getLogs().filter(item => item.id !== row.id)));
      entry.append(title, details, meta, time, remove); list.append(entry);
    });
  }
  function downloadFile(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function csvCell(input) { return `"${value(input).replace(/"/g, '""')}"`; }
  function exportLogsCsv() {
    const lines = [["日期", "胶片", "显影液/稀释", "时间", "温度°C", "结果", "备注"], ...getLogs().map(row => [row.at, row.film, row.developer, row.time, row.temp, row.rating, row.notes])];
    downloadFile(`devchart-log-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${lines.map(row => row.map(csvCell).join(",")).join("\n")}`, "text/csv;charset=utf-8");
  }

  function initTools() {
    [$("#temp-time"), $("#temp-from"), $("#temp-to")].forEach(input => input.addEventListener("input", updateTemperatureTool));
    [$("#push-time"), $("#push-stops"), $("#push-percent")].forEach(input => input.addEventListener("input", updatePushTool)); updateTemperatureTool(); updatePushTool();
    restoreFixerTool();
    [$("#fixer-clear-time"), $("#fixer-multiplier"), $("#fixer-volume"), $("#fixer-capacity")].forEach(input => input.addEventListener("input", () => updateFixerTool()));
    $("#fixer-add-roll").addEventListener("click", () => { const state = safeJson(STORAGE.fixer, {}); state.rolls = (Number(state.rolls) || 0) + 1; state.createdAt ||= new Date().toISOString(); localStorage.setItem(STORAGE.fixer, JSON.stringify(state)); updateFixerTool(); showToast("已记录一卷定影用量"); });
    $("#fixer-reset").addEventListener("click", () => { if (!confirm("确定已经更换或重新配制定影液？当前卷数将归零。")) return; const state = safeJson(STORAGE.fixer, {}); state.rolls = 0; state.createdAt = new Date().toISOString(); localStorage.setItem(STORAGE.fixer, JSON.stringify(state)); updateFixerTool(); showToast("已开始新的定影液批次"); });
    $("#wash-start").addEventListener("click", startWashGuide); $("#wash-continue").addEventListener("click", continueWashGuide); $("#wash-cancel").addEventListener("click", () => { $("#wash-alert").hidden = true; });
    [$("#reciprocity-film"), $("#reciprocity-time")].forEach(input => input.addEventListener("input", updateReciprocityTool)); updateReciprocityTool();
    [$("#strip-base"), $("#strip-step"), $("#strip-count")].forEach(input => input.addEventListener("input", () => buildStripSequence())); buildStripSequence();
    $("#strip-toggle").addEventListener("click", () => stripTimer.running ? pauseStripTimer() : startStripTimer()); $("#strip-reset").addEventListener("click", () => resetStripTimer());
    $("#tank-format").addEventListener("change", () => updateTankTool(true)); [$("#tank-unit-volume"), $("#tank-count")].forEach(input => input.addEventListener("input", () => updateTankTool())); updateTankTool(true);
    $("#tank-save").addEventListener("click", () => { const profiles = tankProfiles(); profiles[$("#tank-format").value] = Math.max(1, Number($("#tank-unit-volume").value) || 1); localStorage.setItem(STORAGE.tank, JSON.stringify(profiles)); showToast("当前冲洗罐容量已保存"); });
    $("#tank-to-mix").addEventListener("click", () => { $("#mix-volume").value = (Number($("#tank-unit-volume").value) || 0) * (Number($("#tank-count").value) || 1); calculateMix(); navigate("chemistry"); showToast("已把冲洗罐总量带入配液计算器"); });
    $("#notch-film").addEventListener("change", updateNotchTool); updateNotchTool();
    renderLogs();
    if (timer.recipe) { $("#log-film").value = timer.recipe.film || ""; $("#log-developer").value = [timer.recipe.developer, timer.recipe.dilution].filter(Boolean).join(" "); $("#log-time").value = timer.recipe.rawTime || ""; $("#log-temp").value = Number.parseFloat(timer.recipe.temp) || 20; }
    $("#log-form").addEventListener("submit", event => { event.preventDefault(); const row = cleanLog({ film: $("#log-film").value, developer: $("#log-developer").value, time: $("#log-time").value, temp: $("#log-temp").value, rating: $("#log-rating").value, notes: $("#log-notes").value }); saveLogs([row, ...getLogs()]); $("#log-notes").value = ""; showToast("冲洗记录已保存在本机"); });
    $("#log-export-json").addEventListener("click", () => downloadFile(`devchart-log-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getLogs(), null, 2), "application/json"));
    $("#log-export-csv").addEventListener("click", exportLogsCsv);
    $("#log-import").addEventListener("change", async event => { const file = event.target.files?.[0]; if (!file) return; try { const rows = JSON.parse(await file.text()); if (!Array.isArray(rows)) throw new Error("格式错误"); saveLogs([...rows.map(cleanLog), ...getLogs()]); showToast(`已导入 ${rows.length} 条记录`); } catch { showToast("JSON 导入失败，请检查文件格式"); } event.target.value = ""; });
    const checked = safeJson(STORAGE.checklist, {});
    $$("#checklist input").forEach(input => { input.checked = Boolean(checked[input.dataset.check]); input.addEventListener("change", () => { const state = {}; $$("#checklist input").forEach(box => { state[box.dataset.check] = box.checked; }); localStorage.setItem(STORAGE.checklist, JSON.stringify(state)); }); });
    $("#reset-checklist").addEventListener("click", () => { $$("#checklist input").forEach(input => { input.checked = false; }); localStorage.removeItem(STORAGE.checklist); showToast("清单已重置"); });
  }

  initRouting(); initTimer(); initMixCalculator(); initTools(); loadData();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
