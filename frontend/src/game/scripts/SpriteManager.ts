import { GumloopClient } from 'gumloop';

export class SpriteManager {
    static sprite: string | null = null; // Store the sprite Base64 string
    static loaded: boolean = false;

    static client: GumloopClient = new GumloopClient({
        apiKey: `${import.meta.env.VITE_SPRITE_API_KEY}`,
        userId: `${import.meta.env.VITE_SPRITE_USER_ID}`,
    });

    static async generateSprite(prompt: string): Promise<void> {
        try {
            const sprite = await this.client.runFlow(`${import.meta.env.VITE_SPRITE_FLOW_ID}`, {
                prompt,
            });

            const base64Image = String(sprite.output);
            console.log(`Generated sprite (Base64 preview):`, base64Image.slice(0, 100), "...");

            if (base64Image) {
                this.sprite = `data:image/png;base64,${base64Image}`;
                console.log('Sprite successfully loaded.');
                this.loaded = true;
            } else {
                console.error('Generated sprite is empty or invalid.');
            }
        } catch (error) {
            console.error('Failed to generate sprite:', error);
        }
    }

    
    

    static getSprite(): string | null {
        return this.sprite;
    }
}