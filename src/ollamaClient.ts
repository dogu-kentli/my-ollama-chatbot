import axios from 'axios';

export class OllamaClient {
    private baseUrl = 'http://localhost:11434';
    private model = 'qwen2.5-coder:1.5b';

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