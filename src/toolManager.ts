import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ToolManager {
    private workspaceRoot: string;

    constructor() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            this.workspaceRoot = '';
            return;
        }
        this.workspaceRoot = folders[0].uri.fsPath;
    }

    async readFile(filePath: string): Promise<string> {
        if (!this.workspaceRoot) {
            throw new Error('Proje açık değil! Lütfen bir klasör açın.');
        }
        const fullPath = path.join(this.workspaceRoot, filePath);
        return await fs.promises.readFile(fullPath, 'utf-8');
    }

    async runCommand(command: string): Promise<string> {
        if (!this.workspaceRoot) {
            throw new Error('Proje açık değil! Lütfen bir klasör açın.');
        }
        const { stdout, stderr } = await execAsync(command, {
            cwd: this.workspaceRoot
        });
        return stdout || stderr || 'Komut çalıştı.';
    }

    async listFiles(): Promise<string[]> {
        if (!this.workspaceRoot) {
            throw new Error('Proje açık değil! Lütfen bir klasör açın.');
        }
        const files: string[] = [];
        const walk = async (dir: string) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else {
                    files.push(path.relative(this.workspaceRoot, fullPath));
                }
            }
        };
        await walk(this.workspaceRoot);
        return files;
    }
}