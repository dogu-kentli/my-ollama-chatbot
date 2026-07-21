import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';

let chatPanel: ChatPanel;

export function activate(context: vscode.ExtensionContext) {
    chatPanel = new ChatPanel();
    const disposable = vscode.commands.registerCommand('my-chatbot.start', () => {
        chatPanel.show();
    });
    context.subscriptions.push(disposable);
}

export function deactivate() {}