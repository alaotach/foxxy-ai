/**
 * Seek Mode Handler for Browser Extension
 * Handles element highlighting, searching, and interaction
 */

class SeekModeHandler {
    constructor() {
        this.isActive = false;
        this.highlightedElements = [];
        this.seekOverlay = null;
        this.searchType = null;
        this.currentQuery = null;
    }

    /**
     * Start seek mode
     */
    start(query, seekType = 'auto') {
        this.isActive = true;
        this.currentQuery = query;
        this.searchType = seekType;
        
        // Create visual overlay
        this.createSeekOverlay(query);
        
        // Add seek mode styles
        this.injectSeekStyles();
        
        console.log(`🔍 Seek Mode Started: "${query}" (${seekType})`);
    }

    /**
     * Stop seek mode
     */
    stop() {
        this.isActive = false;
        this.removeSeekOverlay();
        this.clearHighlights();
        console.log('🔍 Seek Mode Stopped');
    }

    /**
     * Create visual overlay showing seek mode is active
     */
    createSeekOverlay(query) {
        // Remove existing overlay
        this.removeSeekOverlay();
        
        this.seekOverlay = document.createElement('div');
        this.seekOverlay.id = 'foxxy-seek-overlay';
        this.seekOverlay.innerHTML = `
            <div class="seek-header">
                <span class="seek-icon">🔍</span>
                <span class="seek-query">Seeking: "${query}"</span>
                <button class="seek-close">✕</button>
            </div>
            <div class="seek-results">
                <span class="seek-status">Searching...</span>
            </div>
        `;
        
        document.body.appendChild(this.seekOverlay);
        
        // Close button handler
        this.seekOverlay.querySelector('.seek-close').addEventListener('click', () => {
            this.stop();
        });
    }

    /**
     * Remove seek overlay
     */
    removeSeekOverlay() {
        if (this.seekOverlay) {
            this.seekOverlay.remove();
            this.seekOverlay = null;
        }
    }

    /**
     * Update seek status
     */
    updateStatus(message, type = 'info') {
        if (this.seekOverlay) {
            const statusEl = this.seekOverlay.querySelector('.seek-status');
            statusEl.textContent = message;
            statusEl.className = `seek-status seek-status-${type}`;
        }
    }

    /**
     * Seek text on the page
     */
    seekText(query) {
        const results = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim().toLowerCase().includes(query.toLowerCase())) {
                const element = node.parentElement;
                if (this.isElementVisible(element)) {
                    results.push({
                        element: element,
                        text: node.nodeValue.trim(),
                        bounds: element.getBoundingClientRect()
                    });
                }
            }
        }

        return results;
    }

    /**
     * Seek element by selector or description
     */
    seekElement(selectorOrDescription) {
        const results = [];
        
        // Try as CSS selector first
        try {
            const elements = document.querySelectorAll(selectorOrDescription);
            elements.forEach(el => {
                if (this.isElementVisible(el)) {
                    results.push({
                        element: el,
                        selector: selectorOrDescription,
                        bounds: el.getBoundingClientRect()
                    });
                }
            });
            
            if (results.length > 0) {
                return results;
            }
        } catch (e) {
            // Not a valid selector, treat as description
        }
        
        // Search by text content, aria-label, title, etc.
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const description = selectorOrDescription.toLowerCase();
            
            if (text.includes(description) || 
                ariaLabel.includes(description) || 
                title.includes(description)) {
                
                if (this.isElementVisible(el)) {
                    results.push({
                        element: el,
                        description: selectorOrDescription,
                        bounds: el.getBoundingClientRect()
                    });
                }
            }
        });
        
        return results;
    }

    /**
     * Check if element is visible
     */
    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }

    /**
     * Highlight found elements
     */
    highlightElements(results, action = 'highlight') {
        // Clear previous highlights
        this.clearHighlights();
        
        results.forEach((result, index) => {
            const bounds = result.bounds;
            
            // Create highlight overlay
            const highlight = document.createElement('div');
            highlight.className = 'foxxy-seek-highlight';
            highlight.style.position = 'fixed';
            highlight.style.left = bounds.left + 'px';
            highlight.style.top = bounds.top + 'px';
            highlight.style.width = bounds.width + 'px';
            highlight.style.height = bounds.height + 'px';
            highlight.style.zIndex = '999999';
            
            // Add label
            const label = document.createElement('div');
            label.className = 'foxxy-seek-label';
            label.textContent = `${index + 1}`;
            highlight.appendChild(label);
            
            // Click handler
            if (action === 'click') {
                highlight.style.cursor = 'pointer';
                highlight.addEventListener('click', () => {
                    result.element.click();
                });
            }
            
            document.body.appendChild(highlight);
            this.highlightedElements.push(highlight);
        });
        
        // Update status
        this.updateStatus(`Found ${results.length} match${results.length !== 1 ? 'es' : ''}`, 'success');
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
        this.highlightedElements.forEach(el => el.remove());
        this.highlightedElements = [];
    }

    /**
     * Inject seek mode styles
     */
    injectSeekStyles() {
        if (document.getElementById('foxxy-seek-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'foxxy-seek-styles';
        style.textContent = `
            #foxxy-seek-overlay {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                z-index: 1000000;
                min-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: seekSlideIn 0.3s ease-out;
            }
            
            @keyframes seekSlideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .seek-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .seek-icon {
                font-size: 20px;
                animation: seekPulse 2s ease-in-out infinite;
            }
            
            @keyframes seekPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
            
            .seek-query {
                flex: 1;
                font-weight: 600;
                font-size: 14px;
            }
            
            .seek-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .seek-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .seek-results {
                background: rgba(255, 255, 255, 0.1);
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 13px;
            }
            
            .seek-status {
                display: block;
            }
            
            .seek-status-success {
                color: #4ade80;
            }
            
            .seek-status-error {
                color: #f87171;
            }
            
            .foxxy-seek-highlight {
                border: 3px solid #667eea;
                background: rgba(102, 126, 234, 0.15);
                pointer-events: none;
                animation: seekHighlightPulse 1.5s ease-in-out infinite;
                transition: all 0.3s ease;
            }
            
            @keyframes seekHighlightPulse {
                0%, 100% {
                    border-color: #667eea;
                    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
                }
                50% {
                    border-color: #764ba2;
                    box-shadow: 0 0 0 8px rgba(102, 126, 234, 0);
                }
            }
            
            .foxxy-seek-label {
                position: absolute;
                top: -24px;
                left: 0;
                background: #667eea;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                pointer-events: auto;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Perform seek based on type
     */
    performSeek(query, seekType, action) {
        let results = [];
        
        switch (seekType) {
            case 'text':
                results = this.seekText(query);
                break;
            case 'element':
                results = this.seekElement(query);
                break;
            case 'auto':
                // Try element first, then text
                results = this.seekElement(query);
                if (results.length === 0) {
                    results = this.seekText(query);
                }
                break;
        }
        
        if (results.length > 0) {
            this.highlightElements(results, action);
            return {
                found: true,
                count: results.length,
                results: results.map(r => ({
                    bounds: r.bounds,
                    text: r.text || r.element.textContent.substring(0, 50)
                }))
            };
        } else {
            this.updateStatus('No matches found', 'error');
            return {
                found: false,
                count: 0
            };
        }
    }
}

// Global instance
const seekModeHandler = new SeekModeHandler();

// Message handler
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startSeekMode') {
            seekModeHandler.start(message.query, message.seek_type);
            const result = seekModeHandler.performSeek(
                message.query,
                message.seek_type,
                message.action || 'highlight'
            );
            sendResponse(result);
        } else if (message.action === 'stopSeekMode') {
            seekModeHandler.stop();
            sendResponse({ stopped: true });
        }
    });
}

// Export for use in content scripts
if (typeof window !== 'undefined') {
    window.seekModeHandler = seekModeHandler;
}
