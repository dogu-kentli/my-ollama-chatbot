import axios from 'axios';

export class OllamaClient {
    private baseUrl = 'http://localhost:11434';
    private model = 'qwen2.5-coder:1.5b';
    private availableModels: string[] = [];

    async setModel(model: string) {
        this.model = model;
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            const models = response.data.models?.map((m: any) => m.name) || [];
            this.availableModels = models;
            return models;
        } catch (error) {
            console.error('Model listesi alınamadı:', error);
            return [];
        }
    }

    getCurrentModel(): string {
        return this.model;
    }

    async sendMessage(message: string): Promise<string> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: this.model,
                messages: [{ role: 'user', content: message }],
                stream: false
            });
            return response.data.message.content;
        } catch (error) {
            return '❌ Ollama bağlantı hatası!';
        }
    }
}
