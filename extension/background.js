// Background script for extension

console.log('🦊 Foxy AI background script loaded');

// Listen for installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Foxy AI installed! 🎉');
  }
});

// Optional: Handle keyboard shortcuts or other background tasks
browser.commands.onCommand.addListener((command) => {
  if (command === 'toggle-foxy') {
    browser.sidebarAction.toggle();
  }
});
