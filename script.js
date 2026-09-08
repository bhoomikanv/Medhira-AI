/* =========================================================
  Medhira AI — Frontend logic
  No API key ever lives here. All Claude calls go through
  /.netlify/functions/chat
========================================================= */

(() => {
  "use strict";

  /* ---------- Constants ---------- */
  const STORAGE_KEYS = {
    conversations: "medhira.conversations",
    settings: "medhira.settings",
  };

  const DEFAULT_SETTINGS = {
    theme: "system",
    personality: "helpful",
    customInstructions: "",
  };

  const PERSONALITY_PROMPTS = {
    helpful:
      "Be balanced, direct, and genuinely useful. Get to the point without being curt.",
    friendly:
      "Be warm, conversational, and encouraging, like a knowledgeable friend.",
    professional:
      "Be formal, precise, and businesslike. Avoid casual language.",
    teacher:
      "Be patient and pedagogical. Break ideas into clear steps and check understanding.",
    creative:
      "Be imaginative and expressive. Use vivid language and original framing.",
  };

  const BASE_SYSTEM_PROMPT =
    "You are Medhira AI, a helpful, intelligent, friendly, and respectful AI assistant. " +
    "Give accurate, clear, useful answers. When explaining difficult concepts, make them easy " +
    "to understand. Do not pretend to know information you do not know.";

  /* ---------- State ---------- */
  let conversations = loadConversations();
  let settings = loadSettings();
  let currentConversationId = null;
  let isSending = false;

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);

  const els = {
    sidebar: $("sidebar"),
    scrim: $("scrim"),
    menuToggle: $("menuToggle"),
    mobileNewChat: $("mobileNewChat"),
    newChatBtn: $("newChatBtn"),
    historyList: $("historyList"),
    historyEmpty: $("historyEmpty"),
    settingsBtn: $("settingsBtn"),
    chatScroll: $("chatScroll"),
    emptyState: $("emptyState"),
    messages: $("messages"),
    composerForm: $("composerForm"),
    messageInput: $("messageInput"),
    sendBtn: $("sendBtn"),
    settingsOverlay: $("settingsOverlay"),
    closeSettings: $("closeSettings"),
    cancelSettings: $("cancelSettings"),
    saveSettings: $("saveSettings"),
    themeSegmented: $("themeSegmented"),
    customInstructions: $("customInstructions"),
    confirmOverlay: $("confirmOverlay"),
    cancelNewChat: $("cancelNewChat"),
    confirmNewChat: $("confirmNewChat"),
    toast: $("toast"),
  };

  /* ---------- Storage helpers ---------- */
  function loadConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.conversations);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.conversations,
        JSON.stringify(conversations)
      );
    } catch {
      showToast(
        "Couldn't save chat history — your browser storage may be full."
      );
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      return raw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
        : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify(settings)
      );
    } catch {
      /* non-fatal */
    }
  }

  /* ---------- Theme ---------- */
  function applyTheme() {
    let effective = settings.theme;

    if (effective === "system") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    document.documentElement.setAttribute("data-theme", effective);
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (settings.theme === "system") applyTheme();
    });

  /* ---------- Toast ---------- */
  let toastTimer = null;

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 4200);
  }

  /* ---------- Sidebar (mobile) ---------- */
  function openSidebar() {
    els.sidebar.classList.add("open");
    els.scrim.hidden = false;
    els.menuToggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.scrim.hidden = true;
    els.menuToggle.setAttribute("aria-expanded", "false");
  }

  els.menuToggle.addEventListener("click", () => {
    els.sidebar.classList.contains("open")
      ? closeSidebar()
      : openSidebar();
  });

  els.scrim.addEventListener("click", closeSidebar);

  /* ---------- Conversation helpers ---------- */
  function getConversation(id) {
    return conversations.find((c) => c.id === id) || null;
  }

  function createConversation() {
    const convo = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: null,
      messages: [],
      createdAt: Date.now(),
    };

    conversations.unshift(convo);

    return convo;
  }

  function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);

    saveConversations();

    if (currentConversationId === id) {
      currentConversationId = null;
      renderEmptyChat();
    }

    renderHistory();
  }

  function titleFromMessage(text) {
    const clean = text.trim().replace(/\s+/g, " ");

    return clean.length > 42
      ? clean.slice(0, 42).trimEnd() + "…"
      : clean || "New chat";
  }

  /* ---------- Rendering: history ---------- */
  function renderHistory() {
    els.historyList.innerHTML = "";
    els.historyEmpty.hidden = conversations.length > 0;

    conversations.forEach((c) => {
      const li = document.createElement("li");

      li.className =
        "history-item" +
        (c.id === currentConversationId ? " active" : "");

      const open = document.createElement("button");

      open.type = "button";
      open.className = "history-open";

      open.setAttribute(
        "aria-current",
        c.id === currentConversationId ? "true" : "false"
      );

      const title = document.createElement("span");

      title.className = "history-item-title";
      title.textContent = c.title || "New chat";

      open.appendChild(title);

      open.addEventListener("click", () => {
        selectConversation(c.id);
      });

      const del = document.createElement("button");

      del.type = "button";
      del.className = "history-delete";

      del.setAttribute(
        "aria-label",
        `Delete conversation: ${c.title || "New chat"}`
      );

      del.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<polyline points="3 6 5 6 21 6"/>' +
        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
        '<path d="M10 11v6"/>' +
        '<path d="M14 11v6"/>' +
        '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>' +
        "</svg>";

      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteConversation(c.id);
      });

      li.appendChild(open);
      li.appendChild(del);

      els.historyList.appendChild(li);
    });
  }

  function selectConversation(id) {
    currentConversationId = id;

    const convo = getConversation(id);

    renderMessages(convo ? convo.messages : []);
    renderHistory();
    closeSidebar();
  }

  /* ---------- Rendering: messages ---------- */
  function renderEmptyChat() {
    els.messages.innerHTML = "";
    els.emptyState.hidden = false;
  }

  function renderMessages(messages) {
    els.messages.innerHTML = "";

    if (!messages.length) {
      els.emptyState.hidden = false;
      return;
    }

    els.emptyState.hidden = true;

    messages.forEach((m) => {
      appendMessageEl(m.role, m.content);
    });

    scrollToBottom();
  }

  function formatBubbleHTML(text) {
    const escape = (s) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const escaped = escape(text);

    const withCodeBlocks = escaped.replace(
      /```([\s\S]*?)```/g,
      (_, code) => `<pre><code>${code.trim()}</code></pre>`
    );

    const withInlineCode = withCodeBlocks.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );

    const paragraphs = withInlineCode
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");

    return paragraphs;
  }

  function roleToClass(role) {
    return role === "assistant" ? "ai" : role;
  }

  function appendMessageEl(role, text, { asError = false } = {}) {
    els.emptyState.hidden = true;

    const row = document.createElement("div");

    row.className = `msg ${roleToClass(role)}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";

    const body = document.createElement("div");
    body.className = "msg-body";

    const bubble = document.createElement("div");

    bubble.className = "bubble" + (asError ? " error" : "");
    bubble.innerHTML = formatBubbleHTML(text);

    body.appendChild(bubble);

    row.appendChild(avatar);
    row.appendChild(body);

    els.messages.appendChild(row);

    return { row, bubble };
  }

  function appendTypingIndicator() {
    const row = document.createElement("div");

    row.className = "msg ai";
    row.id = "typingRow";

    row.innerHTML = `
      <div class="msg-avatar"></div>
      <div class="msg-body">
        <div class="bubble">
          <span class="typing">
            <span></span><span></span><span></span>
          </span>
          <span class="typing-label">Medhira is thinking…</span>
        </div>
      </div>
    `;

    els.messages.appendChild(row);

    scrollToBottom();

    return row;
  }

  function scrollToBottom() {
    els.chatScroll.scrollTop = els.chatScroll.scrollHeight;
  }

  /* ---------- Typing / reveal animation for AI response ---------- */
  function revealText(bubbleEl, fullText) {
    if (fullText.includes("```")) {
      return new Promise((resolve) => {
        bubbleEl.style.opacity = "0";
        bubbleEl.innerHTML = formatBubbleHTML(fullText);

        requestAnimationFrame(() => {
          bubbleEl.style.transition = "opacity 0.25s ease";
          bubbleEl.style.opacity = "1";

          scrollToBottom();

          setTimeout(resolve, 260);
        });
      });
    }

    return new Promise((resolve) => {
      const chars = Array.from(fullText);
      let i = 0;

      const chunkSize = Math.max(
        1,
        Math.round(chars.length / 120)
      );

      function step() {
        i += chunkSize;

        const shown = chars.slice(0, i).join("");

        bubbleEl.innerHTML = formatBubbleHTML(shown);

        scrollToBottom();

        if (i < chars.length) {
          requestAnimationFrame(step);
        } else {
          bubbleEl.innerHTML = formatBubbleHTML(fullText);
          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  }

  /* ---------- Sending messages ---------- */
  function autoResizeInput() {
    els.messageInput.style.height = "auto";

    els.messageInput.style.height =
      Math.min(els.messageInput.scrollHeight, 160) + "px";
  }

  els.messageInput.addEventListener("input", autoResizeInput);

  els.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (
        typeof els.composerForm.requestSubmit ===
        "function"
      ) {
        els.composerForm.requestSubmit();
      } else {
        els.composerForm.dispatchEvent(
          new Event("submit", { cancelable: true })
        );
      }
    }
  });

  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      els.messageInput.value = card.dataset.prompt || "";

      autoResizeInput();

      els.messageInput.focus();
    });
  });

  function buildSystemPrompt() {
    const parts = [BASE_SYSTEM_PROMPT];

    const personalityLine =
      PERSONALITY_PROMPTS[settings.personality];

    if (personalityLine) {
      parts.push(personalityLine);
    }

    if (
      settings.customInstructions &&
      settings.customInstructions.trim()
    ) {
      parts.push(
        `Additional instructions from the user: ${settings.customInstructions.trim()}`
      );
    }

    return parts.join("\n\n");
  }

  function setSending(state) {
    isSending = state;

    els.sendBtn.disabled = state;
    els.messageInput.disabled = state;
  }

  els.composerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSending) return;

    const text = els.messageInput.value.trim();

    if (!text) return;

    if (!currentConversationId) {
      const convo = createConversation();
      currentConversationId = convo.id;
    }

    const convo = getConversation(currentConversationId);

    if (!convo) {
      showToast("Couldn't open this conversation. Please start a new chat.");
      return;
    }

    convo.messages.push({
      role: "user",
      content: text,
    });

    if (!convo.title) {
      convo.title = titleFromMessage(text);
    }

    saveConversations();
    renderHistory();

    appendMessageEl("user", text);

    els.messageInput.value = "";

    autoResizeInput();
    scrollToBottom();

    setSending(true);
    appendTypingIndicator();

    try {
      const reply = await callChatFunction(
        convo.messages,
        buildSystemPrompt()
      );

      document.getElementById("typingRow")?.remove();

      convo.messages.push({
        role: "assistant",
        content: reply,
      });

      saveConversations();

      const { bubble } = appendMessageEl(
        "assistant",
        ""
      );

      await revealText(bubble, reply);

      scrollToBottom();
    } catch (err) {
      document.getElementById("typingRow")?.remove();

      const message = friendlyErrorMessage(err);

      appendMessageEl(
        "assistant",
        message,
        { asError: true }
      );

      showToast(message);
    } finally {
      setSending(false);
      els.messageInput.focus();
    }
  });

  /* ---------- Error messages ---------- */
  const ERROR_MESSAGES = {
    network:
      "Medhira couldn't reach the server. Check your connection and try again.",

    timeout:
      "That took too long to respond. Please try again.",

    rate_limited:
      "Medhira is getting a lot of requests right now. Please wait a moment and try again.",

    missing_key:
      "Medhira's AI connection isn't configured yet. Please check back soon.",

    invalid_key:
      "Medhira's AI connection is misconfigured. Please check the API key in Netlify settings.",

    empty_messages:
      "Please enter a message before sending.",

    upstream_error:
      "Medhira couldn't get a response from Claude right now. Please try again.",

    invalid_upstream_response:
      "Medhira received an unexpected response. Please try again.",

    invalid_response:
      "Medhira received an unexpected response. Please try again.",

    server_error:
      "Something went wrong on Medhira's end. Please try again.",
  };

  function friendlyErrorMessage(err) {
    const code = (err && err.message) || "";

    return (
      ERROR_MESSAGES[code] ||
      "Something went wrong while getting a response. Please try again."
    );
  }

  async function callChatFunction(messages, systemPrompt) {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000);

    let res;

    try {
      res = await fetch("/.netlify/functions/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),

          system: systemPrompt,
        }),

        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(
        err && err.name === "AbortError"
          ? "timeout"
          : "network"
      );
    } finally {
      clearTimeout(timeoutId);
    }

    let data = null;

    try {
      data = await res.json();
    } catch {
      throw new Error("invalid_response");
    }

    if (!res.ok) {
      throw new Error(data?.error || "server_error");
    }

    if (!data || typeof data.reply !== "string") {
      throw new Error("invalid_response");
    }

    return data.reply;
  }

  /* ---------- New chat ---------- */

  function startNewChat() {
    const current = currentConversationId
      ? getConversation(currentConversationId)
      : null;

    /*
      If we're already on an empty chat, reset it instead
      of creating unlimited empty chats.
    */
    if (current && current.messages.length === 0) {
      current.title = null;
      current.messages = [];

      saveConversations();

      renderEmptyChat();
      renderHistory();

      closeSidebar();

      els.messageInput.value = "";

      autoResizeInput();

      setSending(false);

      document.getElementById("typingRow")?.remove();

      els.messageInput.focus();

      return;
    }

    /*
      Create a completely fresh conversation.
    */
    const convo = createConversation();

    currentConversationId = convo.id;

    /*
      Reset UI state.
    */
    isSending = false;

    els.messageInput.value = "";
    els.messageInput.disabled = false;
    els.sendBtn.disabled = false;

    document.getElementById("typingRow")?.remove();

    els.messages.innerHTML = "";
    els.emptyState.hidden = false;

    /*
      Save and update history immediately.
    */
    saveConversations();
    renderHistory();

    closeSidebar();

    autoResizeInput();

    els.messageInput.focus();
  }

  function requestNewChat() {
    const convo = currentConversationId
      ? getConversation(currentConversationId)
      : null;

    /*
      Ask for confirmation only when the current
      conversation contains messages.
    */
    if (convo && convo.messages.length > 0) {
      els.confirmOverlay.hidden = false;

      if (els.confirmNewChat) {
        els.confirmNewChat.focus();
      }

      return;
    }

    startNewChat();
  }

  /* ---------- New Chat buttons ---------- */

  if (els.newChatBtn) {
    els.newChatBtn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        requestNewChat();
      }
    );
  }

  if (els.mobileNewChat) {
    els.mobileNewChat.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        requestNewChat();
      }
    );
  }

  /* ---------- Confirmation dialog ---------- */

  if (els.confirmOverlay) {
    els.confirmOverlay.addEventListener("click", (e) => {
      const actionEl = e.target.closest("[data-action]");

      /* Cancel */
      if (
        actionEl &&
        actionEl.dataset.action ===
          "cancel-new-chat"
      ) {
        e.preventDefault();
        e.stopPropagation();

        els.confirmOverlay.hidden = true;

        return;
      }

      /* Confirm */
      if (
        actionEl &&
        actionEl.dataset.action ===
          "confirm-new-chat"
      ) {
        e.preventDefault();
        e.stopPropagation();

        els.confirmOverlay.hidden = true;

        startNewChat();

        return;
      }

      /* Click outside dialog */
      if (e.target === els.confirmOverlay) {
        els.confirmOverlay.hidden = true;
      }
    });
  }

  /* ---------- Settings ---------- */

  function openSettings() {
    if (!els.settingsOverlay) return;

    els.settingsOverlay.hidden = false;

    if (els.customInstructions) {
      els.customInstructions.value =
        settings.customInstructions || "";
    }
  }

  function closeSettings() {
    if (!els.settingsOverlay) return;

    els.settingsOverlay.hidden = true;
  }

  if (els.settingsBtn) {
    els.settingsBtn.addEventListener(
      "click",
      openSettings
    );
  }

  if (els.closeSettings) {
    els.closeSettings.addEventListener(
      "click",
      closeSettings
    );
  }

  if (els.cancelSettings) {
    els.cancelSettings.addEventListener(
      "click",
      closeSettings
    );
  }

  if (els.settingsOverlay) {
    els.settingsOverlay.addEventListener(
      "click",
      (e) => {
        if (e.target === els.settingsOverlay) {
          closeSettings();
        }
      }
    );
  }

  if (els.themeSegmented) {
    els.themeSegmented.addEventListener(
      "click",
      (e) => {
        const button =
          e.target.closest("[data-theme]");

        if (!button) return;

        const theme = button.dataset.theme;

        if (
          theme !== "system" &&
          theme !== "light" &&
          theme !== "dark"
        ) {
          return;
        }

        settings.theme = theme;

        applyTheme();

        els.themeSegmented
          .querySelectorAll("[data-theme]")
          .forEach((btn) => {
            btn.setAttribute(
              "aria-pressed",
              btn.dataset.theme === theme
                ? "true"
                : "false"
            );
          });
      }
    );
  }

  if (els.saveSettings) {
    els.saveSettings.addEventListener(
      "click",
      () => {
        if (els.customInstructions) {
          settings.customInstructions =
            els.customInstructions.value.trim();
        }

        saveSettings();
        applyTheme();
        closeSettings();

        showToast("Settings saved.");
      }
    );
  }

  /* ---------- Initial render ---------- */

  applyTheme();
  renderHistory();
  renderEmptyChat();
  autoResizeInput();

  /*
    Start with a fresh temporary conversation only when
    there is no existing conversation selected.
  */
  if (conversations.length === 0) {
    const convo = createConversation();
    currentConversationId = convo.id;

    saveConversations();
    renderHistory();
  }
})();
