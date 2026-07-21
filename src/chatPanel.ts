import * as vscode from 'vscode';
import { OllamaClient } from './ollamaClient';
import { ToolManager } from './toolManager';

export class ChatPanel {
    private panel: vscode.WebviewPanel | undefined;
    private ollama = new OllamaClient();
    private tools: ToolManager;

    constructor() {
        this.tools = new ToolManager();
    }

    show() {
        if (this.panel) { this.panel.reveal(); return; }

        this.panel = vscode.window.createWebviewPanel(
            'ollamaChat',
            'Ollama Chat',
            vscode.ViewColumn.Beside,
            { 
                enableScripts: true,
                enableCommandUris: true,
                localResourceRoots: []
            }
        );

        this.panel.webview.html = this.getHtml();
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'chat') await this.handleChat(msg.text);
            if (msg.type === 'listFiles') await this.handleListFiles();
            if (msg.type === 'getModels') await this.handleGetModels();
            if (msg.type === 'setModel') await this.handleSetModel(msg.model);
        });
        this.panel.onDidDispose(() => { this.panel = undefined; });
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:; style-src 'unsafe-inline' vscode-resource:;">
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body { 
        display: flex;
        flex-direction: column;
        height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
    }

    /* Header */
    #header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--vscode-panel-border);
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: space-between;
        background: var(--vscode-sideBar-background);
    }

    #header-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    #header h2 {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    /* Model Selector */
    #model-selector {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
    }

    #model-dropdown {
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        transition: border-color 0.2s;
    }

    #model-dropdown:hover {
        border-color: var(--vscode-focusBorder);
    }

    #model-dropdown:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }

    /* Messages Container */
    #messages { 
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    #messages::-webkit-scrollbar {
        width: 10px;
    }

    #messages::-webkit-scrollbar-track {
        background: transparent;
    }

    #messages::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-background);
        border-radius: 5px;
    }

    #messages::-webkit-scrollbar-thumb:hover {
        background: var(--vscode-scrollbarSlider-hoverBackground);
    }

    /* Message Bubble */
    .message-group {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
    }

    .message-group.user {
        justify-content: flex-end;
    }

    .message-content {
        max-width: 85%;
        padding: 8px 12px;
        border-radius: 6px;
        word-wrap: break-word;
        white-space: pre-wrap;
        overflow-x: auto;
        font-size: 13px;
        line-height: 1.5;
    }

    .message-group.bot .message-content {
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-left: 2px solid var(--vscode-testing-message-pass-foreground);
    }

    .message-group.user .message-content {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 12px;
    }

    .message-group.tool .message-content {
        background: var(--vscode-statusBarItem-warningBackground);
        color: var(--vscode-statusBarItem-warningForeground);
        border-left: 2px solid var(--vscode-statusBarItem-warningBackground);
    }

    .message-group.error .message-content {
        background: var(--vscode-inputValidation-errorBackground);
        color: var(--vscode-inputValidation-errorForeground);
        border-left: 2px solid var(--vscode-testing-message-error-foreground);
    }

    .message-icon {
        font-size: 16px;
        margin-top: 2px;
        min-width: 20px;
        text-align: center;
    }

    .message-group.user .message-icon {
        order: 2;
    }

    .typing-indicator {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: 8px 12px;
    }

    .typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--vscode-input-foreground);
        animation: typing 1.4s infinite;
    }

    .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
    }

    .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes typing {
        0%, 60%, 100% {
            opacity: 0.3;
        }
        30% {
            opacity: 1;
        }
    }

    /* Input Area */
    #input-area {
        padding: 12px 16px;
        border-top: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
        display: flex;
        gap: 8px;
        align-items: flex-end;
    }

    .input-wrapper {
        flex: 1;
        display: flex;
        gap: 8px;
        align-items: center;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        padding: 8px 12px;
        transition: border-color 0.2s;
    }

    .input-wrapper:focus-within {
        border-color: var(--vscode-focusBorder);
    }

    #input {
        flex: 1;
        background: transparent;
        color: var(--vscode-input-foreground);
        border: none;
        outline: none;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        max-height: 100px;
    }

    #input::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }

    .button-group {
        display: flex;
        gap: 6px;
    }

    button {
        padding: 6px 12px;
        cursor: pointer;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
        min-width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    button:hover {
        background: var(--vscode-button-hoverBackground);
    }

    button:active {
        transform: scale(0.95);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    #send {
        background: var(--vscode-testing-message-pass-foreground);
        color: white;
    }

    #send:hover {
        background: var(--vscode-testing-message-pass-foreground);
        opacity: 0.9;
    }

    #files {
        background: var(--vscode-statusBarItem-warningBackground);
        color: var(--vscode-statusBarItem-warningForeground);
    }

    #clear {
        background: transparent;
        color: var(--vscode-errorForeground);
        border: 1px solid var(--vscode-errorForeground);
    }

    #clear:hover {
        background: var(--vscode-inputValidation-errorBackground);
    }

    /* Empty State */
    #empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--vscode-descriptionForeground);
        gap: 12px;
    }

    #empty-state-icon {
        font-size: 48px;
        opacity: 0.5;
    }

    #empty-state-text {
        font-size: 13px;
        text-align: center;
        max-width: 300px;
        line-height: 1.6;
    }
</style>
</head>
<body>
<div id="header">
    <div id="header-left">
        <span>💬</span>
        <h2>Ollama Chat</h2>
    </div>
    <div id="model-selector">
        <label for="model-dropdown" style="font-size: 11px;">Model:</label>
        <select id="model-dropdown" title="Modeli seçin">
            <option value="">Yükleniyor...</option>
        </select>
    </div>
</div>
<div id="messages">
    <div id="empty-state">
        <div id="empty-state-icon">🤖</div>
        <div id="empty-state-text">
            <strong>Ollama AI Chat</strong><br>
            Bir soru sorun veya dosya listeleyin
        </div>
    </div>
</div>
<div id="input-area">
    <div class="input-wrapper">
        <input id="input" placeholder="Mesaj yaz..." />
    </div>
    <div class="button-group">
        <button id="send" title="Gönder (Enter)">➤</button>
        <button id="files" title="Dosyaları Listele">📁</button>
        <button id="clear" title="Temizle">🗑️</button>
    </div>
</div>
<script>
    (function() {
        const vscode = acquireVsCodeApi();
        const msgs = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        const filesBtn = document.getElementById('files');
        const clearBtn = document.getElementById('clear');
        const modelDropdown = document.getElementById('model-dropdown');
        const emptyState = document.getElementById('empty-state');
        let isLoading = false;

        // Model seçici yükle
        function loadModels() {
            vscode.postMessage({ type: 'getModels' });
        }

        modelDropdown.addEventListener('change', function() {
            if (this.value) {
                vscode.postMessage({ type: 'setModel', model: this.value });
            }
        });

        window.addEventListener('message', function(event) {
            const message = event.data;
            
            if (message.type === 'models') {
                // Modelleri dropdown'a ekle
                modelDropdown.innerHTML = '';
                if (message.models && message.models.length > 0) {
                    message.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        if (model === message.currentModel) {
                            option.selected = true;
                        }
                        modelDropdown.appendChild(option);
                    });
                } else {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'Model yok';
                    option.disabled = true;
                    modelDropdown.appendChild(option);
                }
                return;
            }

            removeTypingIndicator();
            isLoading = false;
            sendBtn.disabled = false;
            filesBtn.disabled = false;

            if (message.type === 'response') {
                addMessage(message.content, 'bot', '🤖');
            } else if (message.type === 'tool') {
                addMessage(message.content, 'tool', '⚙️');
            } else if (message.type === 'error') {
                addMessage(message.content, 'error', '❌');
            } else if (message.type === 'filesList') {
                addMessage(message.files, 'tool', '📁');
            }
        });

        function removeEmptyState() {
            if (emptyState && emptyState.parentElement === msgs) {
                emptyState.remove();
            }
        }

        function createMessageGroup(content, type, icon = '') {
            const group = document.createElement('div');
            group.className = 'message-group ' + type;

            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            messageContent.textContent = content;

            if (icon) {
                const iconEl = document.createElement('div');
                iconEl.className = 'message-icon';
                iconEl.textContent = icon;
                group.appendChild(iconEl);
            }

            group.appendChild(messageContent);
            return group;
        }

        function addMessage(content, type, icon = '') {
            removeEmptyState();
            const group = createMessageGroup(content, type, icon);
            msgs.appendChild(group);
            msgs.scrollTop = msgs.scrollHeight;
        }

        function showTypingIndicator() {
            removeEmptyState();
            const group = document.createElement('div');
            group.className = 'message-group bot';
            group.id = 'typing-indicator';

            const iconEl = document.createElement('div');
            iconEl.className = 'message-icon';
            iconEl.textContent = '🤖';

            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.className = 'typing-dot';
                indicator.appendChild(dot);
            }

            group.appendChild(iconEl);
            group.appendChild(indicator);
            msgs.appendChild(group);
            msgs.scrollTop = msgs.scrollHeight;
        }

        function removeTypingIndicator() {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) indicator.remove();
        }

        function send() {
            const text = input.value.trim();
            if (!text || isLoading) return;

            isLoading = true;
            sendBtn.disabled = true;
            input.value = '';

            addMessage(text, 'user', '👤');
            showTypingIndicator();

            vscode.postMessage({ type: 'chat', text });
        }

        sendBtn.onclick = send;
        input.onkeypress = function(e) { 
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        };

        filesBtn.onclick = function() { 
            isLoading = true;
            filesBtn.disabled = true;
            showTypingIndicator();
            vscode.postMessage({ type: 'listFiles' }); 
        };

        clearBtn.onclick = function() { 
            msgs.innerHTML = '<div id="empty-state"><div id="empty-state-icon">🤖</div><div id="empty-state-text"><strong>Ollama AI Chat</strong><br>Bir soru sorun veya dosya listeleyin</div></div>';
            emptyState = document.getElementById('empty-state');
        };

        // Auto-focus input
        input.focus();
        
        // Modelleri başlangıçta yükle
        loadModels();
    })();
</script>
</body>
</html>`;
    }

    private async handleGetModels() {
        const models = await this.ollama.getAvailableModels();
        const currentModel = this.ollama.getCurrentModel();
        this.panel?.webview.postMessage({ 
            type: 'models', 
            models,
            currentModel
        });
    }

    private async handleSetModel(model: string) {
        await this.ollama.setModel(model);
        this.panel?.webview.postMessage({ 
            type: 'response', 
            content: `✅ Model değiştirildi: ${model}` 
        });
    }

    private async handleChat(text: string) {
        try {
            const response = await this.ollama.sendMessage(text);
            this.panel?.webview.postMessage({ type: 'response', content: response });
            await this.checkTools(response);
        } catch (err: any) {
            this.panel?.webview.postMessage({ type: 'error', content: err.message });
        }
    }

    private async checkTools(response: string) {
        const readMatch = response.match(/oku:\s*(.+)/);
        if (readMatch) {
            try {
                const content = await this.tools.readFile(readMatch[1].trim());
                this.panel?.webview.postMessage({
                    type: 'tool',
                    content: '📄 ' + readMatch[1] + '\n\n' + content.substring(0, 500)
                });
            } catch (err: any) {
                this.panel?.webview.postMessage({ type: 'error', content: err.message });
            }
            return;
        }

        const cmdMatch = response.match(/komut:\s*(.+)/);
        if (cmdMatch) {
            try {
                const result = await this.tools.runCommand(cmdMatch[1].trim());
                this.panel?.webview.postMessage({
                    type: 'tool',
                    content: '💻 ' + cmdMatch[1] + '\n\n' + result
                });
            } catch (err: any) {
                this.panel?.webview.postMessage({ type: 'error', content: err.message });
            }
        }
    }

    private async handleListFiles() {
        try {
            const files = await this.tools.listFiles();
            this.panel?.webview.postMessage({
                type: 'filesList',
                files: files.slice(0, 30).join('\n') || 'Dosya yok'
            });
        } catch (err: any) {
            this.panel?.webview.postMessage({ type: 'error', content: err.message });
        }
    }
}
