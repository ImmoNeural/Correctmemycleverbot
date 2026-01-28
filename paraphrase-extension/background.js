// Paraphrase Extension - Background Script
// Handles context menu and communication with content script

const PARAPHRASE_STYLES = [
  { id: 'formal', title: 'Formal / Profissional', emoji: '👔' },
  { id: 'informal', title: 'Informal / Casual', emoji: '😊' },
  { id: 'concise', title: 'Conciso / Resumido', emoji: '📝' },
  { id: 'detailed', title: 'Detalhado / Expandido', emoji: '📖' },
  { id: 'creative', title: 'Criativo / Original', emoji: '🎨' },
  { id: 'simple', title: 'Simples / Fácil de entender', emoji: '💡' },
  { id: 'academic', title: 'Acadêmico / Científico', emoji: '🎓' },
  { id: 'friendly', title: 'Amigável / Empático', emoji: '🤗' }
];

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu item
  chrome.contextMenus.create({
    id: 'paraphrase-parent',
    title: '✨ Parafrasear texto',
    contexts: ['selection']
  });

  // Sub-menu for each style
  PARAPHRASE_STYLES.forEach(style => {
    chrome.contextMenus.create({
      id: `paraphrase-${style.id}`,
      parentId: 'paraphrase-parent',
      title: `${style.emoji} ${style.title}`,
      contexts: ['selection']
    });
  });

  // Quick paraphrase option (uses last selected style or default)
  chrome.contextMenus.create({
    id: 'paraphrase-quick',
    title: '⚡ Parafrasear rapidamente',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'paraphrase-quick') {
    // Get last used style or default to 'formal'
    chrome.storage.local.get(['lastStyle'], (result) => {
      const style = result.lastStyle || 'formal';
      sendParaphraseRequest(tab.id, info.selectionText, style);
    });
  } else if (info.menuItemId.startsWith('paraphrase-')) {
    const style = info.menuItemId.replace('paraphrase-', '');
    if (style !== 'parent') {
      // Save as last used style
      chrome.storage.local.set({ lastStyle: style });
      sendParaphraseRequest(tab.id, info.selectionText, style);
    }
  }
});

// Send paraphrase request to content script
function sendParaphraseRequest(tabId, text, style) {
  chrome.tabs.sendMessage(tabId, {
    action: 'paraphrase',
    text: text,
    style: style
  });
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStyles') {
    sendResponse({ styles: PARAPHRASE_STYLES });
  }
  return true;
});
