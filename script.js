  /* ---------- New chat ---------- */

  function startNewChat() {
    const current = currentConversationId
      ? getConversation(currentConversationId)
      : null;

    // If we're already on an empty chat, simply reset it.
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

    // Create a completely fresh conversation.
    const convo = createConversation();
    currentConversationId = convo.id;

    // Reset UI state.
    isSending = false;
    els.messageInput.value = "";
    els.messageInput.disabled = false;
    els.sendBtn.disabled = false;

    document.getElementById("typingRow")?.remove();

    els.messages.innerHTML = "";
    els.emptyState.hidden = false;

    // Save and update the history immediately.
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

    // Ask for confirmation only when the current chat contains messages.
    if (convo && convo.messages.length > 0) {
      els.confirmOverlay.hidden = false;
      els.confirmNewChat?.focus();
    } else {
      startNewChat();
    }
  }

  // Desktop New Chat button.
  els.newChatBtn.addEventListener("click", requestNewChat);

  // Mobile New Chat button.
  els.mobileNewChat.addEventListener("click", requestNewChat);

  // Confirmation dialog.
  els.confirmOverlay.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");

    // Cancel.
    if (actionEl?.dataset.action === "cancel-new-chat") {
      e.preventDefault();
      e.stopPropagation();

      els.confirmOverlay.hidden = true;
      return;
    }

    // Confirm.
    if (actionEl?.dataset.action === "confirm-new-chat") {
      e.preventDefault();
      e.stopPropagation();

      els.confirmOverlay.hidden = true;
      startNewChat();
      return;
    }

    // Clicking outside the dialog closes it.
    if (e.target === els.confirmOverlay) {
      els.confirmOverlay.hidden = true;
    }
  });
