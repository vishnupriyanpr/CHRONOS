/* ==========================================================================
   CHRONOS // EDITORIAL MINIMALIST CLIENT CONTROLLER
   Aesthetic: Pure White, Off-Black (#111), Crisp Hairline Borders
   Typography: Satoshi Bold Everywhere | JetBrains Mono Data Floor
   ========================================================================== */

let state = {
  activeView: 'chat',
  chatHistory: [],
  channels: [],
  calendar: [],
  mcps: [],
  models: [],
  activeModel: 'qwen2.5:3b',
  activeProvider: 'ollama',
  briefing: null,
  activeEvent: null,
  targetDeadline: null,
  isProcessing: false,
  timelineFilter: 'all'
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  startLiveClock();
  startRadarCountdown();
  await loadModels();
  await loadChatHistory();
  await loadBriefing();
  await loadEventsAndRadar();
  await loadCalendar();
  await loadMcps();
  await loadChannels();

  // Periodic background check
  setInterval(loadBriefing, 15000);
  setInterval(checkModelStatus, 10000);
}

// ── Clock & Countdown Engines ──────────────────────────────────────────

function startLiveClock() {
  const clockEl = document.getElementById("live-clock");
  if (!clockEl) return;
  const update = () => {
    const d = new Date();
    clockEl.textContent = d.toTimeString().split(' ')[0];
  };
  update();
  setInterval(update, 1000);
}

function startRadarCountdown() {
  const cdEl = document.getElementById("radar-countdown");
  const timelineCdEl = document.getElementById("timeline-countdown-display");
  setInterval(() => {
    let text = "--:--:--";
    if (!state.targetDeadline) {
      text = "--:--:--";
    } else {
      const now = new Date();
      const diff = state.targetDeadline - now;
      if (diff <= 0) {
        text = "DEADLINE REACHED";
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        if (days > 0) {
          text = `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
        } else {
          text = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }
    }
    if (cdEl) cdEl.textContent = text;
    const tEl = document.getElementById("timeline-countdown-display");
    if (tEl) tEl.textContent = text;
  }, 1000);
}

// ── Models & Provider Switcher ─────────────────────────────────────────

async function loadModels() {
  try {
    const res = await fetch("/api/models");
    const models = await res.json();
    state.models = models;

    const activeRes = await fetch("/api/models/active");
    const activeData = await activeRes.json();
    state.activeModel = activeData.model || 'qwen3.5:9b';
    state.activeProvider = activeData.provider || 'ollama';

    renderModelSelector();
    checkModelStatus();
  } catch (err) {
    console.warn("Could not load models list:", err);
  }
}

function renderModelSelector() {
  const selector = document.getElementById("model-selector");
  if (!selector) return;

  const ollamaModels = state.models.filter(m => m.provider === 'ollama');
  const groqModels = state.models.filter(m => m.provider === 'groq');

  let html = '';
  if (ollamaModels.length > 0) {
    html += '<optgroup label="Local (Ollama)">';
    ollamaModels.forEach(m => {
      const selected = m.id === state.activeModel ? 'selected' : '';
      html += `<option value="${escapeHtml(m.id)}" data-provider="ollama" ${selected}>${escapeHtml(m.name)} [Local]</option>`;
    });
    html += '</optgroup>';
  }

  if (groqModels.length > 0) {
    html += '<optgroup label="Cloud (Groq LPU)">';
    groqModels.forEach(m => {
      const selected = m.id === state.activeModel ? 'selected' : '';
      html += `<option value="${escapeHtml(m.id)}" data-provider="groq" ${selected}>${escapeHtml(m.name)} [Groq]</option>`;
    });
    html += '</optgroup>';
  }

  if (!html) {
    html = `<option value="${escapeHtml(state.activeModel)}" selected>${escapeHtml(state.activeModel)}</option>`;
  }

  selector.innerHTML = html;
}

async function switchModel(modelId) {
  const selectedObj = state.models.find(m => m.id === modelId);
  const provider = selectedObj ? selectedObj.provider : (modelId.includes('/') ? 'groq' : 'ollama');

  state.activeModel = modelId;
  state.activeProvider = provider;

  updateModelActivity('idle', `Switched to ${modelId}`);

  try {
    const res = await fetch("/api/models/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, provider: provider })
    });
    const data = await res.json();
    checkModelStatus();
  } catch (err) {
    console.error("Failed to switch model:", err);
  }
}

async function checkModelStatus() {
  const dot = document.getElementById("model-status-dot");
  try {
    const res = await fetch("/api/models/status");
    const data = await res.json();
    if (dot) {
      dot.className = data.status === "online" 
        ? "size-1.5 rounded-full bg-emerald-500" 
        : "size-1.5 rounded-full bg-amber-500";
    }
  } catch (err) {
    if (dot) dot.className = "size-1.5 rounded-full bg-zinc-400";
  }
}

// ── Sidebar Model Activity Monitor ─────────────────────────────────────

function updateModelActivity(mode, label) {
  const fill = document.getElementById("model-activity-fill");
  const text = document.getElementById("model-activity-text");

  if (!fill || !text) return;

  if (mode === 'thinking') {
    fill.style.width = '100%';
    fill.className = 'h-full activity-active';
    text.textContent = label || `Reasoning with ${state.activeModel}...`;
    text.className = 'text-[13px] font-mono text-[#111] font-semibold';
  } else if (mode === 'streaming') {
    fill.style.width = '100%';
    fill.className = 'h-full bg-[#111] transition-all duration-150';
    text.textContent = label || 'Streaming response...';
    text.className = 'text-[13px] font-mono text-[#111] font-semibold';
  } else {
    fill.style.width = '0%';
    fill.className = 'h-full bg-zinc-300 transition-all duration-300';
    text.textContent = label || 'Model idle';
    text.className = 'text-[13px] font-mono text-zinc-400';
  }
}

// ── View Switcher ──────────────────────────────────────────────────────

function switchView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll(".view-panel").forEach(p => p.classList.add("hidden"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove("hidden");

  ['chat', 'matrix', 'mcps', 'channels'].forEach(v => {
    const btn = document.getElementById(`nav-${v}`);
    if (btn) {
      if (v === viewName) {
        btn.className = "nav-btn nav-btn-active";
      } else {
        btn.className = "nav-btn text-zinc-600 hover:bg-zinc-50 hover:text-[#111]";
      }
    }
  });

  if (viewName === 'matrix') renderFullCalendar();
  if (viewName === 'mcps') renderFullMcps();
  if (viewName === 'channels') renderFullChannels();
  if (viewName === 'chat') scrollToBottom();
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.toggle("hidden");
}

// ── Events, Radar & Briefing ───────────────────────────────────────────

async function loadEventsAndRadar() {
  try {
    const res = await fetch("/api/events");
    const events = await res.json();
    if (events.length > 0) {
      state.activeEvent = events[0];
      state.targetDeadline = new Date(events[0].deadline.replace("Z", ""));
      const titleEl = document.getElementById("radar-event-title");
      if (titleEl) titleEl.textContent = events[0].title;
    }
    updateRadarProgress();
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

function updateRadarProgress() {
  const tasks = state.calendar.filter(i => i.type === 'milestone_task' || i.type === 'task_due');
  const countEl = document.getElementById("sidebar-task-count");
  if (countEl) countEl.textContent = tasks.length;

  if (tasks.length === 0) {
    setRadarProgress(0);
    return;
  }
  const completed = tasks.filter(t => t.status === 'done').length;
  const pct = Math.round((completed / tasks.length) * 100);
  setRadarProgress(pct);
}

function setRadarProgress(pct) {
  const bar = document.getElementById("radar-progress-bar");
  const text = document.getElementById("radar-progress-pct");
  if (bar) bar.style.width = `${pct}%`;
  if (text) text.textContent = `${pct}%`;
}

async function loadBriefing() {
  try {
    const res = await fetch("/api/briefing");
    const data = await res.json();
    state.briefing = data;
  } catch (err) {
    console.error("Failed to load briefing:", err);
  }
}

// ── Chat Engine with Real-Time Streaming & Thinking Animation ──────────

async function loadChatHistory() {
  try {
    const res = await fetch("/api/chat/history");
    const history = await res.json();
    state.chatHistory = history;
    renderChat();
  } catch (err) {
    console.error("Failed to load chat history:", err);
  }
}

function renderChat() {
  const container = document.getElementById("chat-history");
  if (!container) return;

  const heroDeck = document.getElementById("hero-command-deck");

  if (!state.chatHistory || state.chatHistory.length === 0) {
    if (heroDeck) heroDeck.classList.remove("hidden");
    container.innerHTML = "";
    if (heroDeck) container.appendChild(heroDeck);
    return;
  }

  if (heroDeck) heroDeck.classList.add("hidden");

  let html = state.chatHistory.map(msg => renderMessageHtml(msg)).join("");
  container.innerHTML = html;
  scrollToBottom();
}

function renderMessageHtml(msg) {
  const isUser = msg.role === "user";
  const formattedContent = formatMarkdown(msg.content);

  if (isUser) {
    return `
      <div class="flex justify-end animate-fadeIn my-6">
        <div class="max-w-xl rounded-xl rounded-tr-xs bg-[#111] text-white px-5 py-3.5 text-[15px] font-bold leading-relaxed shadow-sm">
          ${formattedContent}
        </div>
      </div>
    `;
  }

  let cardHtml = "";
  if (msg.card_type === "research_brief" && msg.metadata) {
    cardHtml = renderResearchCard(msg.metadata);
  } else if (msg.card_type === "tasks_and_mcps" && msg.metadata) {
    cardHtml = renderTasksAndMcpsCard(msg.metadata);
  } else if (msg.card_type === "briefing_card" && msg.metadata) {
    cardHtml = renderBriefingCard(msg.metadata);
  } else if (msg.card_type === "channel_connect_trigger") {
    cardHtml = `
      <div class="pt-2">
        <button onclick="switchView('channels')" class="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#111] text-white text-[14px] font-semibold hover:bg-zinc-800 transition-colors cursor-pointer">
          <span>Configure Channels</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="flex items-start gap-4 max-w-3xl animate-fadeIn my-6">
      <div class="size-8 rounded-lg bg-[#111] flex items-center justify-center text-white shrink-0 mt-0.5">
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      <div class="flex-1 space-y-3">
        <div class="text-[15px] text-[#111] leading-relaxed message-content">
          ${formattedContent}
        </div>
        ${cardHtml}
      </div>
    </div>
  `;
}

function renderResearchCard(meta) {
  return `
    <div class="rounded-xl border border-[#e4e4e7] bg-white p-5 space-y-4">
      <div class="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div class="text-[13px] font-mono font-bold uppercase tracking-wider text-[#111]">
          Pre-Research // ${escapeHtml(meta.event_title || '')}
        </div>
        <span class="px-2 py-0.5 rounded text-[12px] font-mono font-semibold bg-zinc-100 text-[#111]">
          Verified
        </span>
      </div>

      <p class="text-[14px] text-zinc-600 leading-relaxed font-bold">
        ${escapeHtml(meta.summary || '')}
      </p>

      <div class="space-y-2 pt-1">
        <div class="text-[12px] font-mono uppercase text-zinc-400 font-semibold">Priority Tracks:</div>
        <div class="flex flex-wrap gap-2">
          <button onclick="quickSend('I want to prioritize Track 1 with Python backend and solo builder mode')" class="h-9 px-3.5 rounded-lg border border-[#e4e4e7] bg-zinc-50 hover:bg-[#111] hover:text-white text-[13px] font-bold text-[#111] transition-all cursor-pointer">
            Track 1: Autonomous Agent (Python)
          </button>
          <button onclick="quickSend('Solo builder mode with full-stack UI, Chrome DevTools testing')" class="h-9 px-3.5 rounded-lg border border-[#e4e4e7] bg-zinc-50 hover:bg-[#111] hover:text-white text-[13px] font-bold text-[#111] transition-all cursor-pointer">
            Solo Builder (Full-Stack UI)
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderTasksAndMcpsCard(meta) {
  const tasks = meta.tasks || [];
  const mcps = meta.mcps || [];

  const tasksHtml = tasks.map(t => `
    <div class="flex items-start gap-3 p-3.5 rounded-lg border border-[#e4e4e7] bg-zinc-50/50 ${t.status === 'done' ? 'opacity-50 line-through' : ''}">
      <input type="checkbox" class="accent-[#111] size-4 rounded mt-1 cursor-pointer" ${t.status === 'done' ? 'checked' : ''} onchange="toggleTaskInChat(${t.id}, this.checked)">
      <div class="flex-1 space-y-1">
        <div class="text-[14px] font-bold text-[#111]">${escapeHtml(t.title)}</div>
        <div class="flex items-center gap-2 text-[12px] font-mono text-zinc-500 font-semibold">
          <span class="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800">${t.phase}</span>
          <span>Due: ${t.due_date || 'TBD'}</span>
          ${t.assigned_mcp ? `<span class="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">Tool: ${escapeHtml(t.assigned_mcp)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join("");

  const mcpsHtml = mcps.slice(0, 3).map(m => `
    <div class="flex items-center justify-between p-3 rounded-lg border border-[#e4e4e7] bg-white font-mono text-[13px]">
      <span class="font-bold text-[#111]">${escapeHtml(m.name)}</span>
      <div class="flex items-center gap-2">
        <code class="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">${escapeHtml(m.install_command)}</code>
        <button onclick="copyToClipboard('${escapeHtml(m.install_command)}', this)" class="px-2 py-0.5 rounded bg-zinc-200 hover:bg-[#111] hover:text-white text-[12px] font-semibold transition-colors cursor-pointer">Copy</button>
      </div>
    </div>
  `).join("");

  return `
    <div class="rounded-xl border border-[#e4e4e7] bg-white p-5 space-y-4">
      <div class="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div class="text-[13px] font-mono font-bold uppercase tracking-wider text-[#111]">
          Phased Milestones &amp; MCP Stack
        </div>
        <button onclick="switchView('matrix')" class="text-[13px] font-semibold text-zinc-600 hover:text-[#111] cursor-pointer">
          Timeline &rarr;
        </button>
      </div>

      <div class="space-y-2">
        ${tasksHtml}
      </div>

      <div class="space-y-2 pt-2 border-t border-zinc-100">
        <div class="text-[12px] font-mono uppercase text-zinc-400 font-semibold">Configured Tools:</div>
        <div class="space-y-2">
          ${mcpsHtml}
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button onclick="exportMcpConfig()" class="h-9 px-4 rounded-lg bg-[#111] text-white text-[13px] font-semibold hover:bg-zinc-800 transition-all cursor-pointer">
          Export Config
        </button>
        <button onclick="switchView('channels')" class="h-9 px-4 rounded-lg border border-[#e4e4e7] hover:bg-zinc-50 text-[13px] font-semibold text-zinc-700 transition-all cursor-pointer">
          Connect Alerts
        </button>
      </div>
    </div>
  `;
}

function renderBriefingCard(meta) {
  const briefing = meta.briefing || {};
  return `
    <div class="rounded-xl border-l-4 border-l-[#111] border border-[#e4e4e7] bg-white p-5 space-y-2">
      <div class="text-[12px] font-mono uppercase text-zinc-500 font-bold">
        ${escapeHtml(briefing.header || 'EXECUTIVE BRIEFING')}
      </div>
      <div class="text-[14px] font-bold text-[#111] leading-snug">
        ${escapeHtml(briefing.message || '')}
      </div>
      <button onclick="switchView('matrix')" class="text-[13px] font-semibold text-zinc-600 hover:text-[#111] underline pt-1 cursor-pointer">
        Inspect Schedule Timeline
      </button>
    </div>
  `;
}

// ── Sending Messages with Real-Time Streaming & Thinking Dots ──────────

async function handleSend(e) {
  if (e) e.preventDefault();
  if (state.isProcessing) return;

  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  state.isProcessing = true;

  const heroDeck = document.getElementById("hero-command-deck");
  if (heroDeck) heroDeck.classList.add("hidden");

  // Optimistic User Bubble
  state.chatHistory.push({
    role: "user",
    content: text,
    card_type: null,
    metadata: {}
  });
  renderChat();

  // Sidebar Thinking Animation
  const startTime = Date.now();
  updateModelActivity('thinking', `Reasoning with ${state.activeModel}...`);

  // Insert In-Chat Thinking Indicator
  const container = document.getElementById("chat-history");
  const thinkingRow = document.createElement("div");
  thinkingRow.id = "thinking-bubble";
  thinkingRow.className = "flex items-start gap-4 max-w-3xl animate-fadeIn my-6";
  thinkingRow.innerHTML = `
    <div class="size-8 rounded-lg bg-[#111] flex items-center justify-center text-white shrink-0 mt-0.5">
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    </div>
    <div class="flex-1 space-y-2">
      <div id="streaming-text-target" class="text-[15px] text-[#111] leading-relaxed message-content">
        <span class="thinking-wave">
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
        </span>
        <span class="ml-2 text-[13px] font-mono text-zinc-400 font-semibold">Thinking with ${escapeHtml(state.activeModel)}...</span>
      </div>
    </div>
  `;
  container.appendChild(thinkingRow);
  scrollToBottom();

  // Determine if this is an event creation or special keyword that needs backend pipeline
  const isUrl = /https?:\/\/[^\s<>"]+/i.test(text);
  const isScoping = state.activeEvent && ["track", "python", "backend", "frontend", "solo", "team"].some(k => text.toLowerCase().includes(k));

  if (isUrl || isScoping) {
    // Pipeline route (scrape or decomposition card)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      updateModelActivity('idle', `Completed in ${elapsed}s`);

      thinkingRow.remove();
      state.chatHistory.push(data);
      renderChat();

      await loadBriefing();
      await loadEventsAndRadar();
      await loadCalendar();
      await loadMcps();
    } catch (err) {
      thinkingRow.remove();
      updateModelActivity('idle', 'Error occurred');
      console.error("Chat error:", err);
    } finally {
      state.isProcessing = false;
    }
    return;
  }

  // Real-Time Streaming Route
  try {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!res.ok) throw new Error("Stream error " + res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let firstToken = true;

    const streamTarget = document.getElementById("streaming-text-target");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.token) {
            if (firstToken) {
              firstToken = false;
              updateModelActivity('streaming', 'Generating tokens...');
              if (streamTarget) streamTarget.innerHTML = '';
            }
            accumulatedText += parsed.token;
            if (streamTarget) {
              streamTarget.innerHTML = formatMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
              scrollToBottom();
            }
          }
        } catch (e) {}
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    updateModelActivity('idle', `Response in ${elapsed}s`);

    thinkingRow.remove();
    state.chatHistory.push({
      role: "assistant",
      content: accumulatedText || "Analysis completed.",
      card_type: null,
      metadata: {}
    });
    renderChat();

  } catch (streamErr) {
    console.warn("Streaming unavailable, falling back to REST /api/chat:", streamErr);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      thinkingRow.remove();
      state.chatHistory.push(data);
      renderChat();
    } catch (restErr) {
      thinkingRow.remove();
      alert("Error contacting local CHRONOS engine: " + restErr);
    }
    updateModelActivity('idle', 'Model idle');
  } finally {
    state.isProcessing = false;
  }
}

function quickSend(text) {
  if (state.activeView !== 'chat') switchView('chat');
  const input = document.getElementById("chat-input");
  if (input) {
    input.value = text;
    handleSend();
  }
}

async function toggleTaskInChat(taskId, isDone) {
  const status = isDone ? "done" : "pending";
  try {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await loadCalendar();
    updateRadarProgress();
    loadBriefing();
  } catch (err) {
    console.error("Failed to update task status:", err);
  }
}

async function resetChat() {
  if (confirm("Reset current conversation session?")) {
    await fetch("/api/chat/reset", { method: "POST" });
    state.chatHistory = [];
    renderChat();
  }
}

function scrollToBottom() {
  const container = document.getElementById("chat-history");
  if (container) container.scrollTop = container.scrollHeight;
}

// ── Timeline Calendar View ─────────────────────────────────────────────

async function loadCalendar() {
  try {
    const res = await fetch("/api/calendar");
    state.calendar = await res.json();
    updateRadarProgress();
    if (state.activeView === 'matrix') renderFullCalendar();
  } catch (err) {
    console.error("Failed to load calendar:", err);
  }
}

function setTimelineFilter(filter) {
  state.timelineFilter = filter;
  ['all', 'pending', 'done', 'deadlines'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = "filter-btn filter-btn-active";
      } else {
        btn.className = "filter-btn";
      }
    }
  });
  renderFullCalendar();
}

function toggleAddTaskForm() {
  const form = document.getElementById("timeline-add-form");
  if (form) form.classList.toggle("hidden");
}

async function handleCreateCustomTask(e) {
  if (e) e.preventDefault();
  const eventId = state.activeEvent ? state.activeEvent.id : 1;
  const title = document.getElementById("new-task-title")?.value?.trim();
  const phase = document.getElementById("new-task-phase")?.value || "Phase 1: Setup";
  const dueDate = document.getElementById("new-task-due")?.value?.trim() || "";
  const assignedMcp = document.getElementById("new-task-mcp")?.value?.trim() || "";
  const priority = document.getElementById("new-task-priority")?.value || "high";

  if (!title) return;

  try {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        title,
        phase,
        due_date: dueDate,
        assigned_mcp: assignedMcp,
        priority
      })
    });

    // Reset and close
    document.getElementById("new-task-title").value = "";
    document.getElementById("new-task-due").value = "";
    document.getElementById("new-task-mcp").value = "";
    toggleAddTaskForm();

    await loadCalendar();
    await loadEventsAndRadar();
    renderFullCalendar();
  } catch (err) {
    alert("Failed to create task: " + err);
  }
}

async function deleteTaskInTimeline(taskId) {
  if (!confirm("Delete this milestone?")) return;
  try {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    await loadCalendar();
    await loadEventsAndRadar();
    renderFullCalendar();
  } catch (err) {
    alert("Delete failed: " + err);
  }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const target = new Date(dateStr.replace(" ", "T"));
    const now = new Date();
    const diffMs = target - now;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) {
      const pastHours = Math.abs(diffHours);
      if (pastHours < 24) return `${pastHours}h overdue`;
      return `${Math.round(pastHours / 24)}d overdue`;
    }
    if (diffHours < 1) return `Due in < 1 hour`;
    if (diffHours < 24) return `Due in ${diffHours} hours`;
    const days = Math.round(diffHours / 24);
    return `Due in ${days} days`;
  } catch (e) {
    return "";
  }
}

function renderFullCalendar() {
  const container = document.getElementById("full-calendar-list");
  if (!container) return;

  // 1. Update Metrics in View Header
  const tasks = state.calendar.filter(i => i.type === 'task_due');
  const deadlines = state.calendar.filter(i => i.type === 'event_deadline');
  const completed = tasks.filter(t => t.status === 'done').length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const totalBadge = document.getElementById("timeline-total-badge");
  if (totalBadge) totalBadge.textContent = `${tasks.length} Milestones`;

  const countdownDisp = document.getElementById("timeline-countdown-display");
  const radarCountdown = document.getElementById("radar-countdown");
  if (countdownDisp && radarCountdown) {
    countdownDisp.textContent = radarCountdown.textContent;
  }

  const eventNameDisp = document.getElementById("timeline-event-name");
  if (eventNameDisp && state.activeEvent) {
    eventNameDisp.textContent = state.activeEvent.title;
  }

  const ratioDisp = document.getElementById("timeline-progress-ratio");
  const barFill = document.getElementById("timeline-bar-fill");
  const detailDisp = document.getElementById("timeline-progress-detail");
  if (ratioDisp) ratioDisp.textContent = `${pct}%`;
  if (barFill) barFill.style.width = `${pct}%`;
  if (detailDisp) detailDisp.textContent = `${completed} of ${tasks.length} milestones cleared`;

  const toolCountDisp = document.getElementById("timeline-tool-count");
  if (toolCountDisp) toolCountDisp.textContent = `${state.mcps.length} Tools Mapped`;

  // 2. Filter Calendar Items
  let filtered = state.calendar;
  if (state.timelineFilter === 'pending') {
    filtered = state.calendar.filter(i => i.type === 'task_due' && i.status !== 'done');
  } else if (state.timelineFilter === 'done') {
    filtered = state.calendar.filter(i => i.type === 'task_due' && i.status === 'done');
  } else if (state.timelineFilter === 'deadlines') {
    filtered = state.calendar.filter(i => i.type === 'event_deadline');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-[14px] text-zinc-500 p-8 bg-zinc-50 rounded-xl border border-[#e4e4e7] space-y-2">
        <div class="text-[15px] font-bold text-[#111]">No milestones match the current filter.</div>
        <div class="text-zinc-400">Switch filter tabs above or click "+ Add Milestone" to schedule a task.</div>
      </div>
    `;
    return;
  }

  let stepNumber = 0;
  container.innerHTML = filtered.map(item => {
    const isDeadline = item.type === 'event_deadline';

    if (isDeadline) {
      return `
        <div class="relative pl-10 my-8">
          <div class="timeline-item-node deadline">
            <svg class="size-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="p-6 rounded-xl border-2 border-[#111] bg-white space-y-3 shadow-md">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-md text-[12px] font-mono font-extrabold bg-[#111] text-white tracking-wider">
                  FINAL TARGET DEADLINE
                </span>
                <span class="text-[13px] font-mono font-bold text-zinc-500">
                  Buffer Lock Active
                </span>
              </div>
              <div class="text-[14px] font-mono font-extrabold text-[#111]">
                ${escapeHtml(item.date)}
              </div>
            </div>

            <div class="text-lg font-extrabold text-[#111] leading-tight">
              ${escapeHtml(item.title)}
            </div>

            ${item.description ? `
              <p class="text-[14px] text-zinc-600 leading-relaxed font-bold">
                ${escapeHtml(item.description)}
              </p>
            ` : ''}

            <div class="flex flex-wrap items-center gap-3 pt-2 text-[13px] font-mono font-bold text-zinc-500">
              <span class="inline-flex items-center gap-1.5 text-emerald-600">
                <span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Automated SAR &amp; Portal Lock Freeze</span>
              </span>
              <span>·</span>
              <span>Local Daemon Monitoring 24/7</span>
            </div>
          </div>
        </div>
      `;
    }

    stepNumber += 1;
    const isDone = item.status === 'done';
    const relativeTime = formatRelativeTime(item.date);

    // Phase styling
    let phaseBadgeClass = "bg-zinc-100 text-[#111]";
    if (item.phase && item.phase.includes("Phase 2")) phaseBadgeClass = "bg-[#111] text-white";
    if (item.phase && item.phase.includes("Phase 4")) phaseBadgeClass = "bg-emerald-100 text-emerald-900 border border-emerald-300";

    return `
      <div class="relative pl-10 my-4 group">
        <!-- Timeline node dot -->
        <div class="timeline-item-node ${isDone ? 'completed' : 'pending-active'}">
          ${isDone ? `
            <svg class="size-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ` : `
            <span class="text-[11px] font-mono font-bold text-[#111]">${stepNumber}</span>
          `}
        </div>

        <!-- Milestone Card -->
        <div class="p-5 rounded-xl border border-[#e4e4e7] ${isDone ? 'bg-zinc-50/70 border-zinc-200 opacity-60' : 'bg-white hover:border-zinc-400 hover:shadow-subtle'} transition-all space-y-3 shadow-2xs">
          
          <!-- Top Row: Phase + Date + Priority -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[12px] font-mono font-bold ${phaseBadgeClass}">
                ${escapeHtml(item.phase || 'Phase Milestone')}
              </span>
              ${item.priority ? `
                <span class="px-2 py-0.5 rounded text-[11px] font-mono font-extrabold uppercase ${item.priority === 'critical' ? 'bg-red-100 text-red-900 border border-red-200' : 'bg-zinc-100 text-zinc-700'}">
                  ${item.priority}
                </span>
              ` : ''}
            </div>

            <div class="flex items-center gap-2 text-[13px] font-mono">
              ${relativeTime ? `
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${relativeTime.includes('overdue') ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}">
                  ${relativeTime}
                </span>
              ` : ''}
              <span class="text-zinc-500 font-semibold">${item.date || 'TBD'}</span>
            </div>
          </div>

          <!-- Middle Row: Interactive Checkbox & Title -->
          <div class="flex items-start gap-3">
            <input 
              type="checkbox" 
              class="accent-[#111] size-5 rounded-md mt-0.5 cursor-pointer shrink-0" 
              ${isDone ? 'checked' : ''} 
              onchange="toggleTaskInTimeline(${item.task_id || 0}, this.checked)"
              title="Mark milestone complete"
            />
            <div class="flex-1 space-y-1">
              <div class="text-[15px] font-extrabold text-[#111] ${isDone ? 'line-through text-zinc-400' : ''}">
                ${escapeHtml(item.title)}
              </div>
              ${item.description ? `
                <p class="text-[13px] text-zinc-500 leading-relaxed font-bold">
                  ${escapeHtml(item.description)}
                </p>
              ` : ''}
            </div>
          </div>

          <!-- Bottom Row: Assigned Tool Context & Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-[13px]">
            <div class="flex items-center gap-2">
              ${item.assigned_mcp ? `
                <div class="flex items-center gap-1.5 font-mono text-[12px] text-zinc-600 font-bold">
                  <svg class="size-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  <span>Tool:</span>
                  <code class="px-1.5 py-0.5 rounded bg-zinc-100 text-[#111] border border-zinc-200">${escapeHtml(item.assigned_mcp)}</code>
                </div>
              ` : `
                <span class="text-zinc-400 font-mono text-[12px]">No tool assigned</span>
              `}
            </div>

            <div class="flex items-center gap-2 shrink-0">
              ${item.task_id ? `
                <button onclick="deleteTaskInTimeline(${item.task_id})" class="text-[12px] font-mono text-zinc-400 hover:text-red-600 cursor-pointer transition-colors" title="Delete milestone">
                  Delete
                </button>
              ` : ''}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join("");
}

async function toggleTaskInTimeline(taskId, isDone) {
  if (!taskId) return;
  const status = isDone ? "done" : "pending";
  try {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await loadCalendar();
    updateRadarProgress();
    loadBriefing();
    renderFullCalendar();
  } catch (err) {
    console.error("Failed to update task status:", err);
  }
}

// ── MCP Catalog View ───────────────────────────────────────────────────

async function loadMcps() {
  try {
    const res = await fetch("/api/mcps");
    state.mcps = await res.json();
    
    // Update sidebar stack (top 3)
    const listEl = document.getElementById("sidebar-mcp-list");
    const moreEl = document.getElementById("sidebar-mcp-more");
    if (listEl) {
      const top3 = state.mcps.slice(0, 3);
      listEl.innerHTML = top3.map(m => `
        <div class="flex items-center justify-between text-[13px] font-mono">
          <span class="text-zinc-600 truncate">${escapeHtml(m.mcp_name)}</span>
          <span class="size-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        </div>
      `).join("");
      
      if (moreEl) {
        if (state.mcps.length > 3) {
          moreEl.classList.remove("hidden");
          moreEl.textContent = `+${state.mcps.length - 3} more tools`;
        } else {
          moreEl.classList.add("hidden");
        }
      }
    }

    const countEl = document.getElementById("sidebar-mcp-count");
    if (countEl) countEl.textContent = state.mcps.length;

    if (state.activeView === 'mcps') renderFullMcps();
  } catch (err) {
    console.error("Failed to load MCPs:", err);
  }
}

function renderFullMcps() {
  const container = document.getElementById("full-mcps-list");
  if (!container) return;

  if (state.mcps.length === 0) {
    container.innerHTML = '<div class="text-[14px] text-zinc-500 col-span-2 p-6 bg-zinc-50 rounded-xl border border-[#e4e4e7]">No active MCP configurations yet. Ingest an event to generate.</div>';
    return;
  }

  container.innerHTML = state.mcps.map(m => `
    <div class="p-5 rounded-xl border border-[#e4e4e7] bg-white space-y-3 shadow-2xs">
      <div class="flex items-center justify-between">
        <span class="text-[15px] font-bold text-[#111]">${escapeHtml(m.mcp_name)}</span>
        <span class="px-2 py-0.5 rounded text-[12px] font-mono font-semibold bg-zinc-100 text-[#111]">
          ${m.is_installed ? 'Installed' : 'Ready'}
        </span>
      </div>
      <p class="text-[13px] text-zinc-600 leading-relaxed font-bold">${escapeHtml(m.description)}</p>
      <div class="flex items-center gap-2 pt-1">
        <code class="flex-1 text-[13px] font-mono font-semibold p-2 rounded bg-zinc-50 border border-[#e4e4e7] text-[#111] truncate">
          ${escapeHtml(m.install_command)}
        </code>
        <button onclick="copyToClipboard('${escapeHtml(m.install_command)}', this)" class="px-3 py-1.5 rounded bg-[#111] text-white text-[13px] font-semibold hover:bg-zinc-800 transition-colors cursor-pointer shrink-0">
          Copy
        </button>
      </div>
    </div>
  `).join("");
}

// ── Notification Channels & Pings ──────────────────────────────────────

async function loadChannels() {
  try {
    const res = await fetch("/api/channels");
    state.channels = await res.json();
    const badge = document.getElementById("sidebar-channel-badge");
    if (badge) {
      badge.className = state.channels.length > 0 ? "size-1.5 rounded-full bg-emerald-500" : "size-1.5 rounded-full bg-zinc-300";
    }
    if (state.activeView === 'channels') renderFullChannels();
  } catch (err) {
    console.error("Failed to load channels:", err);
  }
}

function renderFullChannels() {
  const container = document.getElementById("full-channels-list");
  if (!container) return;

  if (state.channels.length === 0) {
    container.innerHTML = '<div class="text-[14px] text-zinc-400 col-span-2">No external channels linked yet. Configure above.</div>';
    return;
  }

  container.innerHTML = state.channels.map(ch => `
    <div class="flex items-center justify-between p-3.5 rounded-xl border border-[#e4e4e7] bg-white shadow-2xs">
      <div>
        <span class="text-[13px] font-mono font-bold uppercase text-[#111]">[${escapeHtml(ch.platform)}]</span>
        <span class="text-[13px] text-zinc-700 ml-2 font-mono font-semibold">${escapeHtml(ch.target)}</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="testChannelPing(${ch.id})" class="h-8 px-3 rounded-lg border border-[#e4e4e7] hover:bg-zinc-50 text-[13px] font-semibold text-zinc-800 transition-colors cursor-pointer">Ping</button>
        <button onclick="deleteChannel(${ch.id})" class="h-8 w-8 rounded-lg border border-[#e4e4e7] hover:bg-zinc-50 text-[14px] text-zinc-400 hover:text-[#111] flex items-center justify-center transition-colors cursor-pointer">&times;</button>
      </div>
    </div>
  `).join("");
}

async function saveAndTestChannel(platform, targetId, webhookId, tokenId) {
  const target = targetId ? (document.getElementById(targetId)?.value?.trim() || targetId) : "";
  const webhook_url = webhookId ? (document.getElementById(webhookId)?.value?.trim() || "") : "";
  const api_token = tokenId ? (document.getElementById(tokenId)?.value?.trim() || "") : "";

  if (!target && !webhook_url) {
    alert(`Please provide target phone/ID or webhook URL for ${platform}.`);
    return;
  }

  try {
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        target: target || `${platform}_channel`,
        webhook_url,
        api_token
      })
    });
    const data = await res.json();

    const pingRes = await fetch("/api/channels/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: data.channel_id })
    });
    const pingData = await pingRes.json();

    alert(`Connected to ${platform.toUpperCase()}!\nStatus: ${pingData.detail || 'Verified'}`);
    loadChannels();
  } catch (err) {
    alert("Connection failed: " + err);
  }
}

async function testChannelPing(channelId) {
  try {
    const res = await fetch("/api/channels/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: channelId })
    });
    const data = await res.json();
    alert(`Ping dispatched!\nResult: ${data.detail || 'Success'}`);
  } catch (err) {
    alert("Ping failed: " + err);
  }
}

async function deleteChannel(channelId) {
  await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
  loadChannels();
}

async function exportMcpConfig() {
  try {
    const res = await fetch("/api/mcps/export-config", { method: "POST" });
    const data = await res.json();
    alert(`Configuration exported to:\n${data.filepath}`);
  } catch (err) {
    alert("Export failed: " + err);
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}

// ── Markdown Parser ────────────────────────────────────────────────────

function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-[#111]">$1</strong>');
  // Inline Code
  html = html.replace(/`(.*?)`/g, '<code class="font-mono text-[13px] bg-zinc-100 text-[#111] border border-[#e4e4e7] px-1.5 py-0.5 rounded">$1</code>');
  // Numbered list items
  html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<div class="flex items-start gap-2.5 my-2"><span class="shrink-0 font-mono text-[13px] font-bold text-[#111] bg-zinc-100 rounded px-1.5 py-0.5 border border-[#e4e4e7]">$1</span><span class="text-[#111] text-[15px] font-bold leading-relaxed">$2</span></div>');
  // Bullet list items
  html = html.replace(/^[-*]\s+(.*)$/gm, '<div class="flex items-start gap-2.5 my-1.5"><span class="size-1.5 rounded-full bg-[#111] mt-2 shrink-0"></span><span class="text-[#111] text-[15px] font-bold leading-relaxed">$1</span></div>');
  // Paragraphs & Line breaks
  html = html.replace(/\n\n/g, '<div class="h-2.5"></div>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
