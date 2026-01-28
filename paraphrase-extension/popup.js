// Paraphrase Extension - Popup Script
// Handles configuration in the extension popup

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const apiUrlInput = document.getElementById('apiUrl');
  const saveBtn = document.getElementById('saveConfig');
  const statusMessage = document.getElementById('statusMessage');

  // Load saved configuration
  chrome.storage.local.get(['paraphraseConfig'], (result) => {
    const config = result.paraphraseConfig || {};
    if (config.apiKey) {
      apiKeyInput.value = config.apiKey;
    }
    if (config.apiUrl) {
      apiUrlInput.value = config.apiUrl;
    }
  });

  // Save configuration
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();

    chrome.storage.local.set({
      paraphraseConfig: {
        apiKey: apiKey,
        apiUrl: apiUrl || 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo'
      }
    }, () => {
      // Show success message
      statusMessage.classList.add('show');
      setTimeout(() => {
        statusMessage.classList.remove('show');
      }, 2000);
    });
  });

  // Save on Enter key
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });

  apiUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });
});
