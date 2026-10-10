/* ==========================================================================
   CHRONOS // PACEUI & SHADCN CLIENT ENGINE & CONTROLLER
   Aesthetic: Obsidian, Zinc & White | Satoshi Bold Everywhere | Min 14px Text
   ========================================================================== */

let state = {
  activeView: 'chat',
  chatHistory: [],
  channels: [],
  calendar: [],
  mcps: [],
  briefing: null,
  activeEvent: null,
  targetDeadline: null
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  startLiveClock();
  startRadarCountdown();
  await loadChatHistory();
  await loadBriefing();
  await loadEventsAndRadar();
  await loadCalendar();
  await loadMcps();
  await loadChannels();

  // Periodic background refresh
  setInterval(loadBriefing, 15000);
}

// Live Clock Ticker
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

// View Switcher (Chat Sentinel, Timeline Matrix, MCP Orchestrator, Social Dispatcher)
function switchView(viewName) {
  state.activeView = viewName;
  
  // Hide all view panels
  const panels = document.querySelectorAll(".view-panel");
  panels.forEach(p => p.classList.add("hidden"));

  // Show target panel
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove("hidden");
  }

  // Update Header Title
  const titles = {
    chat: 'CHAT SENTINEL',
    matrix: 'TIMELINE MATRIX',
    mcps: 'MCP ORCHESTRATOR',
    channels: 'SOCIAL DISPATCHER'
  };
  const titleEl = document.getElementById("header-view-title");
  if (titleEl) titleEl.textContent = titles[viewName] || 'COMMAND DECK';

  // Update Sidebar active state
  ['chat', 'matrix', 'mcps', 'channels'].forEach(v => {
    const btn = document.getElementById(`nav-${v}`);
    if (btn) {
      if (v === viewName) {
        btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-bold bg-zinc-950 text-white transition-all shadow-2xs cursor-pointer pace-interactive";
      } else {
        btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-bold text-zinc-800 hover:bg-zinc-200/80 hover:text-zinc-950 transition-all cursor-pointer pace-interactive";
      }
    }
  });

  // Trigger view data refreshes
  if (viewName === 'matrix') renderFullCalendar();
  if (viewName === 'mcps') renderFullMcps();
  if (viewName === 'channels') renderFullChannels();
  if (viewName === 'chat') scrollToBottom();
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (sb) {
    sb.classList.toggle("hidden");
  }
}

// Live Deadline Radar & Countdown Engine
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

function startRadarCountdown() {
  const cdEl = document.getElementById("radar-countdown");
  setInterval(() => {
    if (!state.targetDeadline) {
      if (cdEl) cdEl.textContent = "02d 14h 28m 10s";
      return;
    }
    const now = new Date();
    const diff = state.targetDeadline - now;
    if (diff <= 0) {
      if (cdEl) cdEl.textContent = "DEADLINE REACHED";
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    if (cdEl) {
      cdEl.textContent = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
  }, 1000);
}

function updateRadarProgress() {
  const tasks = state.calendar.filter(i => i.type === 'milestone_task');
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

// Executive Briefing Ticker
async function loadBriefing() {
  try {
    const res = await fetch("/api/briefing");
    const data = await res.json();
    state.briefing = data;
    const tickerText = document.getElementById("ticker-text");
    if (tickerText) {
      tickerText.textContent = `[BRIEFING] ${data.message || 'All systems nominal.'}`;
    }
  } catch (err) {
    console.error("Failed to load briefing:", err);
  }
}

// Chat Engine
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

  if (state.chatHistory.length === 0) {
    if (heroDeck) heroDeck.classList.remove("hidden");
    container.innerHTML = "";
    if (heroDeck) container.appendChild(heroDeck);
    return;
  }

  // Active chat has messages: hide initial hero deck
  let html = state.chatHistory.map(msg => renderMessageHtml(msg)).join("");
  container.innerHTML = html;
  scrollToBottom();
}

function renderMessageHtml(msg) {
  const isUser = msg.role === "user";
  const formattedContent = formatMarkdown(msg.content);

  if (isUser) {
    return `
      <div class="flex justify-end animate-fadeIn">
        <div class="max-w-xl rounded-2xl rounded-tr-xs bg-zinc-950 text-white px-6 py-4 text-[15px] font-bold leading-relaxed shadow-sm">
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
        <button onclick="switchView('channels')" class="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-zinc-950 text-white text-[14px] font-bold hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer pace-interactive">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>Configure WhatsApp &amp; Social Channels</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="flex items-start gap-4 max-w-4xl animate-fadeIn">
      <div class="size-9 rounded-xl bg-zinc-950 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      <div class="flex-1 space-y-4">
        <div class="flex items-center gap-2 text-[14px] font-mono font-bold text-zinc-500">
          <span class="text-zinc-950 font-extrabold uppercase">CHRONOS SENTINEL</span>
          <span>•</span>
          <span class="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">Autonomous Scraper</span>
        </div>
        <div class="text-[15px] text-zinc-900 leading-relaxed message-content">
          ${formattedContent}
        </div>
        ${cardHtml}
      </div>
    </div>
  `;
}

function renderResearchCard(meta) {
  return `
    <div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
      <div class="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div class="flex items-center gap-2.5">
          <svg class="size-5 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span class="text-[14px] font-mono font-extrabold tracking-wider uppercase text-zinc-950">
            PRE-RESEARCH DOSSIER // ${escapeHtml(meta.event_title || '')}
          </span>
        </div>
        <span class="px-3 py-1 rounded-full text-[14px] font-mono font-bold bg-zinc-100 text-zinc-900 border border-zinc-200">
          VERIFIED CRAWL
        </span>
      </div>

      <p class="text-[15px] text-zinc-600 leading-relaxed font-bold">
        ${escapeHtml(meta.summary || '')}
      </p>

      <div class="space-y-3 pt-1">
        <div class="text-[14px] font-mono font-extrabold uppercase tracking-wider text-zinc-500">
          Select Your Priority Focus Track:
        </div>
        <div class="flex flex-wrap gap-2.5">
          <button onclick="quickSend('I want to prioritize Track 1 with Python backend and solo builder mode')" class="h-10 px-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-950 hover:text-white text-[14px] font-bold text-zinc-900 transition-all shadow-2xs cursor-pointer pace-interactive">
            Track 1: Autonomous Agent (Python)
          </button>
          <button onclick="quickSend('Solo builder mode with full-stack UI, Chrome DevTools testing')" class="h-10 px-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-950 hover:text-white text-[14px] font-bold text-zinc-900 transition-all shadow-2xs cursor-pointer pace-interactive">
            Solo Builder (Full-Stack UI)
          </button>
          <button onclick="quickSend('Configure backend with SQLite, GitHub MCP, and auto-commits')" class="h-10 px-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-950 hover:text-white text-[14px] font-bold text-zinc-900 transition-all shadow-2xs cursor-pointer pace-interactive">
            Backend Logic + GitHub MCP
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
    <div class="flex items-start gap-3.5 p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/60 hover:bg-zinc-50 transition-colors ${t.status === 'done' ? 'opacity-50 line-through' : ''}">
      <input type="checkbox" class="accent-zinc-950 size-5 rounded-md mt-0.5 cursor-pointer" ${t.status === 'done' ? 'checked' : ''} onchange="toggleTaskInChat(${t.id}, this.checked)">
      <div class="flex-1 space-y-1.5">
        <div class="text-[15px] font-extrabold text-zinc-950">${escapeHtml(t.title)}</div>
        <div class="flex items-center gap-2.5 text-[14px] font-mono font-bold text-zinc-600">
          <span class="px-2 py-0.5 rounded-md bg-zinc-200 text-zinc-900">${t.phase}</span>
          <span>Due: ${t.due_date || 'TBD'}</span>
          ${t.assigned_mcp ? `<span class="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">Tool: ${escapeHtml(t.assigned_mcp)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join("");

  const mcpsHtml = mcps.slice(0, 4).map(m => `
    <div class="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-white font-mono text-[14px]">
      <span class="font-extrabold text-zinc-950">${escapeHtml(m.name)}</span>
      <div class="flex items-center gap-2">
        <code class="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 font-bold">${escapeHtml(m.install_command)}</code>
        <button onclick="copyToClipboard('${escapeHtml(m.install_command)}', this)" class="px-2.5 py-1 rounded-md bg-zinc-200 hover:bg-zinc-950 hover:text-white text-[14px] font-bold transition-colors cursor-pointer">Copy</button>
      </div>
    </div>
  `).join("");

  return `
    <div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
      <div class="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div class="flex items-center gap-2.5">
          <svg class="size-5 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span class="text-[14px] font-mono font-extrabold tracking-wider uppercase text-zinc-950">
            PHASED ROADMAP &amp; RESOLVED MCP TOOLING
          </span>
        </div>
        <button onclick="switchView('matrix')" class="text-[14px] font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 transition-colors cursor-pointer">
          <span>View Matrix</span>
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <div class="space-y-2.5">
        ${tasksHtml}
      </div>

      <div class="space-y-3 pt-2 border-t border-zinc-100">
        <div class="text-[14px] font-mono font-extrabold uppercase tracking-wider text-zinc-500">
          Recommended Model Context Protocol Servers:
        </div>
        <div class="space-y-2.5">
          ${mcpsHtml}
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button onclick="exportMcpConfig()" class="h-10 px-5 rounded-xl bg-zinc-950 text-white text-[14px] font-bold hover:bg-zinc-800 transition-all shadow-2xs flex items-center gap-2 cursor-pointer pace-interactive">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Export mcp_servers.json</span>
        </button>
        <button onclick="switchView('channels')" class="h-10 px-5 rounded-xl border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 text-[14px] font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer pace-interactive">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <span>Connect WhatsApp Alerts</span>
        </button>
      </div>
    </div>
  `;
}

function renderBriefingCard(meta) {
  const briefing = meta.briefing || {};
  return `
    <div class="rounded-2xl border-l-4 border-l-zinc-950 border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
      <div class="text-[14px] font-mono font-extrabold tracking-wider uppercase text-zinc-500">
        ${escapeHtml(briefing.header || 'EXECUTIVE BRIEFING')}
      </div>
      <div class="text-[15px] font-extrabold text-zinc-950 leading-snug">
        ${escapeHtml(briefing.message || '')}
      </div>
      <button onclick="switchView('matrix')" class="text-[14px] font-bold text-zinc-700 hover:text-zinc-950 underline pt-1 inline-flex items-center gap-1.5 cursor-pointer">
        <span>Inspect Schedule Timeline</span>
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `;
}

async function handleSend(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  // Hide hero command deck if visible
  const heroDeck = document.getElementById("hero-command-deck");
  if (heroDeck) heroDeck.classList.add("hidden");

  // Optimistic User Message
  state.chatHistory.push({
    role: "user",
    content: text,
    card_type: null,
    metadata: {}
  });
  renderChat();

  // Show Typing Indicator
  const container = document.getElementById("chat-history");
  const typingRow = document.createElement("div");
  typingRow.id = "typing-indicator";
  typingRow.className = "flex items-start gap-4 max-w-xl animate-fadeIn";
  typingRow.innerHTML = `
    <div class="size-9 rounded-xl bg-zinc-950 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
      <svg class="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
    </div>
    <div class="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3.5 text-[14px] font-mono font-bold text-zinc-600 flex items-center gap-2.5 shadow-2xs">
      <span>CHRONOS analyzing criteria &amp; scheduling...</span>
    </div>
  `;
  container.appendChild(typingRow);
  scrollToBottom();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();

    if (data.reply) {
      state.chatHistory.push(data.reply);
      renderChat();
      loadBriefing();
      loadEventsAndRadar();
      loadCalendar();
    }
  } catch (err) {
    console.error("Chat error:", err);
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();
    alert("Connection error. Ensure local Sentinel backend is active.");
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
  if (confirm("Reset current chat stream?")) {
    await fetch("/api/chat/reset", { method: "POST" });
    state.chatHistory = [];
    renderChat();
  }
}

function scrollToBottom() {
  const container = document.getElementById("chat-history");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// VIEW 2: Full Timeline Calendar Data
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

function renderFullCalendar() {
  const container = document.getElementById("full-calendar-list");
  if (!container) return;

  if (state.calendar.length === 0) {
    container.innerHTML = '<div class="text-[14px] text-zinc-500 font-bold p-6 bg-zinc-50 rounded-2xl border border-zinc-200">No schedule items yet. Ingest an event link in Chat Sentinel.</div>';
    return;
  }

  container.innerHTML = state.calendar.map(item => {
    const isDeadline = item.type === 'event_deadline';
    return `
      <div class="p-5 rounded-2xl border border-zinc-200 ${isDeadline ? 'bg-zinc-50 border-l-6 border-l-zinc-950' : 'bg-white'} space-y-2 shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-[14px] font-mono font-bold text-zinc-500">${item.date || 'TBD'}</span>
          <span class="px-2.5 py-0.5 rounded-md text-[14px] font-mono font-bold ${isDeadline ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-800'}">
            ${isDeadline ? 'FINAL DEADLINE' : 'PHASE MILESTONE'}
          </span>
        </div>
        <div class="text-[16px] font-extrabold text-zinc-950">
          ${escapeHtml(item.title)}
        </div>
        ${item.assigned_mcp ? `
          <div class="text-[14px] font-mono text-zinc-600 font-bold">
            Assigned Tool: <span class="text-zinc-950">${escapeHtml(item.assigned_mcp)}</span>
          </div>` : ''}
      </div>
    `;
  }).join("");
}

// VIEW 3: Full MCP Catalog Data
async function loadMcps() {
  try {
    const res = await fetch("/api/mcps");
    state.mcps = await res.json();
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
    container.innerHTML = '<div class="text-[14px] text-zinc-500 font-bold col-span-2 p-6 bg-zinc-50 rounded-2xl border border-zinc-200">No active MCP configurations. Drop an event link in chat to auto-generate.</div>';
    return;
  }

  container.innerHTML = state.mcps.map(m => `
    <div class="p-6 rounded-2xl border border-zinc-200 bg-white space-y-3.5 shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[16px] font-extrabold text-zinc-950">${escapeHtml(m.mcp_name)}</span>
        <span class="px-3 py-1 rounded-full text-[14px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
          ${m.is_installed ? 'Installed' : 'Ready'}
        </span>
      </div>
      <p class="text-[14px] text-zinc-600 leading-relaxed font-bold">${escapeHtml(m.description)}</p>
      <div class="flex items-center gap-2 pt-1">
        <code class="flex-1 text-[14px] font-mono font-bold p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 truncate">
          ${escapeHtml(m.install_command)}
        </code>
        <button onclick="copyToClipboard('${escapeHtml(m.install_command)}', this)" class="px-3.5 py-2.5 rounded-xl bg-zinc-950 text-white text-[14px] font-bold hover:bg-zinc-800 transition-colors cursor-pointer shrink-0">
          Copy
        </button>
      </div>
    </div>
  `).join("");
}

// VIEW 4: Channels & Socials
async function loadChannels() {
  try {
    const res = await fetch("/api/channels");
    state.channels = await res.json();
    const badge = document.getElementById("sidebar-channel-badge");
    if (badge) {
      badge.className = state.channels.length > 0 ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-zinc-400";
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
    container.innerHTML = '<div class="text-[14px] text-zinc-400 font-bold col-span-2">No external channels linked yet. Configure above.</div>';
    return;
  }

  container.innerHTML = state.channels.map(ch => `
    <div class="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-white shadow-2xs">
      <div>
        <span class="text-[14px] font-mono font-extrabold uppercase text-zinc-950">[${escapeHtml(ch.platform)}]</span>
        <span class="text-[14px] text-zinc-700 ml-2 font-mono font-bold">${escapeHtml(ch.target)}</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="testChannelPing(${ch.id})" class="h-8.5 px-3.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-[14px] font-bold text-zinc-800 transition-colors cursor-pointer">Ping</button>
        <button onclick="deleteChannel(${ch.id})" class="h-8.5 w-8.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-[14px] text-zinc-400 hover:text-zinc-950 flex items-center justify-center transition-colors cursor-pointer">&times;</button>
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
    alert(`Configuration exported successfully to:\n${data.filepath}`);
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

// Helper: Clean Markdown formatting with Word-doc sizing & Satoshi Bold pills
function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-zinc-950">$1</strong>');
  // Inline Code
  html = html.replace(/`(.*?)`/g, '<code class="font-mono text-[14px] font-bold bg-zinc-100 text-zinc-900 border border-zinc-200/90 px-2 py-0.5 rounded-md">$1</code>');
  // Numbered list items (e.g. 1. Question text)
  html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<div class="flex items-start gap-3 my-2.5"><span class="shrink-0 font-mono text-[14px] font-extrabold text-zinc-950 bg-zinc-100 rounded-lg px-2.5 py-1 border border-zinc-300">$1</span><span class="text-zinc-900 text-[15px] font-bold leading-relaxed">$2</span></div>');
  // Bullet list items (- or *)
  html = html.replace(/^[-*]\s+(.*)$/gm, '<div class="flex items-start gap-3 my-2"><span class="size-2 rounded-full bg-zinc-950 mt-2 shrink-0"></span><span class="text-zinc-900 text-[15px] font-bold leading-relaxed">$1</span></div>');
  // Paragraphs & Line breaks
  html = html.replace(/\n\n/g, '<div class="h-3"></div>');
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
