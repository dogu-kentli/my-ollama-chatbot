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
    body { 
        padding: 10px; 
        font-family: sans-serif; 
        background: var(--vscode-editor-background); 
        color: var(--vscode-editor-foreground); 
    }
    #messages { 
        height: 400px; 
        overflow-y: auto; 
        border: 1px solid var(--vscode-panel-border); 
        padding: 10px; 
        background: var(--vscode-input-background); 
    }
    .msg { 
        margin: 5px 0; 
        padding: 8px; 
        border-radius: 4px; 
        white-space: pre-wrap; 
    }
    .user { 
        background: var(--vscode-button-background); 
        color: var(--vscode-button-foreground); 
    }
    .bot { 
        background: var(--vscode-editor-inactiveSelectionBackground); 
        color: var(--vscode-editor-foreground); 
    }
    .tool { 
        background: var(--vscode-statusBarItem-warningBackground); 
        color: var(--vscode-statusBarItem-warningForeground); 
    }
    .error { 
        background: var(--vscode-inputValidation-errorBackground); 
        color: var(--vscode-inputValidation-errorForeground); 
    }
    #input-area { 
        display: flex; 
        gap: 8px; 
        margin-top: 10px; 
    }
    #input { 
        flex: 1; 
        padding: 8px; 
        background: var(--vscode-input-background); 
        color: var(--vscode-input-foreground); 
        border: 1px solid var(--vscode-input-border); 
    }
    button { 
        padding: 8px 16px; 
        cursor: pointer; 
        background: var(--vscode-button-background); 
        color: var(--vscode-button-foreground); 
        border: none; 
        border-radius: 4px; 
    }
    button:hover { 
        background: var(--vscode-button-hoverBackground); 
    }
    #clear { 
        background: transparent; 
        color: var(--vscode-errorForeground); 
        border: 1px solid var(--vscode-errorForeground); 
    }
</style>
</head>
<body>
<div id="messages"></div>
<div id="input-area">
    <input id="input" placeholder="Mesaj yaz..."/>
    <button id="send">Gönder</button>
    <button id="files">Dosyaları Listele</button>
    <button id="clear">Temizle</button>
</div>
<script>
    (function() {
        const vscode = acquireVsCodeApi();
        const msgs = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        const filesBtn = document.getElementById('files');
        const clearBtn = document.getElementById('clear');

        function add(content, type) {
            const d = document.createElement('div');
            d.className = 'msg ' + type;
            d.textContent = content;
            msgs.appendChild(d);
            msgs.scrollTop = msgs.scrollHeight;
        }

        function send() {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            add('Siz: ' + text, 'user');
            vscode.postMessage({ type: 'chat', text });
        }

        sendBtn.onclick = send;
        input.onkeypress = function(e) { if (e.key === 'Enter') send(); };
        filesBtn.onclick = function() { vscode.postMessage({ type: 'listFiles' }); };
        clearBtn.onclick = function() { msgs.innerHTML = ''; };

        window.addEventListener('message', function(event) {
            const message = event.data;
            if (message.type === 'response') {
                add('Bot: ' + message.content, 'bot');
            } else if (message.type === 'tool') {
                add('Araç: ' + message.content, 'tool');
            } else if (message.type === 'error') {
                add('Hata: ' + message.content, 'error');
            } else if (message.type === 'filesList') {
                add('Dosyalar:\\n' + message.files, 'tool');
            }
        });
    })();
</script>
</body>
</html>`;
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
        const readMatch = response.match(/oku:\\s*(.+)/);
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

        const cmdMatch = response.match(/komut:\\s*(.+)/);
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