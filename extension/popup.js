document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableToggle');
    const globalToggle = document.getElementById('globalToggle');
    const statusMessage = document.getElementById('statusMessage');

    // Load current state
    chrome.storage.sync.get(['enabled', 'globalEnabled'], (result) => {
        // Default to true if not set
        const isEnabled = result.enabled !== false;
        const isGlobalEnabled = result.globalEnabled === true;
        
        toggle.checked = isEnabled;
        globalToggle.checked = isGlobalEnabled;
        
        updateStatusUI(isEnabled);
    });

    // Save state on change
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.sync.set({ enabled: isEnabled }, () => {
            updateStatusUI(isEnabled);
        });
    });

    // Global toggle logic
    globalToggle.addEventListener('change', () => {
        const isGlobalEnabled = globalToggle.checked;
        chrome.storage.sync.set({ globalEnabled: isGlobalEnabled }, () => {
            if (isGlobalEnabled) {
                // Send message to current tab to start global annotation
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'startGlobalAnnotation' });
                    }
                });
            }
        });
    });

    function updateStatusUI(isEnabled) {
        if (isEnabled) {
            statusMessage.textContent = 'Service Active';
            statusMessage.className = 'status-active';
        } else {
            statusMessage.textContent = 'Service Inactive';
            statusMessage.className = 'status-inactive';
        }
    }
});
