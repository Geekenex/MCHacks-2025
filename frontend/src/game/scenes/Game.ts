import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { WorldManager } from '../scripts/WorldManager';
import { DialogueManager, DialogueLine } from '../scripts/DialogueManager';
import { GumloopClient } from "gumloop";

interface NPCData {
    id: number;
    x: number;
    y: number;
    interacted: boolean;
    health: number;
    healthBar?: Phaser.GameObjects.Graphics;
    defeated: boolean;
    sprite?: Phaser.Physics.Arcade.Sprite;
}

interface GameInitData {
    playerHP?: number;
    npcIndexToRemove?: number;
    npcWasKilled?: boolean;
    input?: string;
    playerPosition?: { x: number; y: number };
}

export class Game extends Scene {
    static nextNpcId: number = 0;
    static defeatedNpcIds: number[] = [];
    static npcsState: NPCData[] = [];
    static playerPosition: { x: number; y: number } = { x: 256, y: 256 };
    static playerHP: number = 100;

    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
    npcs: NPCData[] = [];
    dialogueManager: DialogueManager;
    currentNpc: NPCData | null = null;
    playerHPInstance: number = 100;
    isInCombat: boolean = false;
    dialogueLines: DialogueLine[] = [];
    dialogueBox: Phaser.GameObjects.Rectangle;
    dialogueText: Phaser.GameObjects.Text;
    private isTransitioning: boolean = false;
    inputPrompt: String;

    // Buffer distance to avoid spawning NPCs too close to the player
    private npcSpawnBuffer: number = 150;

    constructor() {
        super('Game');
    }

    init(data: GameInitData) {
        console.log(`Game scene init with data:`, data);

        if (data.playerHP !== undefined) {
            this.playerHPInstance = data.playerHP;
            Game.playerHP = data.playerHP;
            console.log(`Player HP updated to: ${this.playerHPInstance}`);
        }

        this.isInCombat = false;

        if (data.input) {
            console.log(`Received input from MainMenu: ${data.input}`);
            this.generateNewDialogue(data.input);
            this.inputPrompt = data.input;

            this.generateSprite().catch((error) => {
                console.error("Failed to generate sprite:", error);
            });
        }

        if (data.npcWasKilled && data.npcIndexToRemove !== undefined) {
            this.handleNpcRemoval(data.npcIndexToRemove);
        }

        if (data.playerPosition) {
            Game.playerPosition = data.playerPosition;
            console.log(`Player position set to: (${Game.playerPosition.x}, ${Game.playerPosition.y})`);
        }
    }

    preload() {
        this.load.spritesheet('player', 'assets/player.png', { frameWidth: 256, frameHeight: 256 });
        this.load.spritesheet('npc', 'assets/npc.png', { frameWidth: 512, frameHeight: 512 });
        this.load.image('background1', 'assets/background1.png');
    }

    async generateSprite(): Promise<void> {
        const client = new GumloopClient({
            apiKey: `${import.meta.env.VITE_SPRITE_API_KEY}`,
            userId: `${import.meta.env.VITE_SPRITE_USER_ID}`,
        });

        try {
            const sprite = await client.runFlow(`${import.meta.env.VITE_SPRITE_FLOW_ID}`, {
                prompt: this.inputPrompt,
            });

            const base64Image = String(sprite.output);
            console.log("Generated sprite (Base64):", base64Image.slice(0, 100), "..."); // Log only the first 100 chars

            if (base64Image) {
                this.loadBase64Texture('playerTexture', base64Image);
            } else {
                console.error("Generated sprite is empty or invalid.");
            }
        } catch (error) {
            console.error("Failed to generate sprite:", error);
        }
    }

    loadBase64Texture(key: string, base64Data: string): void {
        try {
            const image = new Image();
            image.src = `data:image/png;base64,${base64Data}`;
            image.onload = () => {
                this.textures.addImage(key, image);
                console.log(`Texture "${key}" successfully loaded from Base64.`);
                this.initializePlayerWithBase64Texture();
            };
        } catch (error) {
            console.error(`Failed to add texture "${key}":`, error);
        }
    }

    initializePlayerWithBase64Texture(): void {
        if (this.textures.exists('playerTexture')) {
            this.player = this.physics.add.sprite(400, 300, 'playerTexture');
            this.player.setScale(0.5);
            this.player.setCollideWorldBounds(true);
            console.log('Player sprite initialized with Base64 texture.');
        } else {
            console.error('Texture "playerTexture" not found. Using fallback texture.');
            this.initializePlayerWithFallback();
        }
    }

    private initializePlayerWithFallback(): void {
        this.player = this.physics.add.sprite(Game.playerPosition.x, Game.playerPosition.y, 'player');
        this.player.setScale(0.5);
        this.player.setCollideWorldBounds(true);
        this.player.play('idle-down');
    }

    private handleNpcRemoval(npcIdToRemove: number): void {
        const npcToRemoveIndex = Game.npcsState.findIndex(npc => npc.id === npcIdToRemove);
        if (npcToRemoveIndex !== -1) {
            Game.npcsState.splice(npcToRemoveIndex, 1);
            Game.defeatedNpcIds.push(npcIdToRemove);
            console.log(`NPC with ID ${npcIdToRemove} marked as defeated and removed from state.`);

            const npcToRemove = this.npcs.find(npc => npc.id === npcIdToRemove);
            if (npcToRemove?.sprite) {
                npcToRemove.sprite.destroy();
                console.log(`NPC sprite with ID ${npcIdToRemove} destroyed.`);
            }
        } else {
            console.warn(`No NPC found with ID ${npcIdToRemove} in state.`);
        }
    }

    generateNewDialogue(input: String): void {
        const client = new GumloopClient({
            apiKey: `${import.meta.env.VITE_API_KEY}`,
            userId: `${import.meta.env.VITE_USER_ID}`,
        });

        const runFlow = async () => {
            try {
                const output = await client.runFlow(`${import.meta.env.VITE_FLOW_ID}`, {
                    prompt: input,
                });

                const responseString = output.response;
                const jsonStart = responseString.indexOf('```json\n') + 8;
                const jsonEnd = responseString.indexOf('\n```', jsonStart);
                const jsonString = responseString.slice(jsonStart, jsonEnd);

                this.dialogueLines = JSON.parse(jsonString);
                console.log('Dialogue lines:', this.dialogueLines);
            } catch (error) {
                console.error("Failed to generate dialogue:", error);
            }
        };

        runFlow();
    }

    updateDialogue(): void {
        this.dialogueManager = new DialogueManager(this, this.dialogueLines, () => {
            if (this.currentNpc) {
                this.isInCombat = true;

                console.log(`Starting CombatScene with NPC ID: ${this.currentNpc.id}`);
                this.cameras.main.shake(3000, 0.01, true);
                this.time.delayedCall(3000, () => {
                    this.scene.start('CombatScene', {
                        playerHP: this.playerHPInstance,
                        npcIndex: this.currentNpc ? this.currentNpc.id : -1,
                        npcWasKilled: true,
                        npcData: { health: this.currentNpc?.health ?? 0 },
                        prompt: this.inputPrompt,
                        playerPosition: { x: this.player.x, y: this.player.y },
                    });
                });

                this.generateNewDialogue(this.inputPrompt);
            }
        });
    }

    create(): void {
        this.handleAnimations();

        if (this.textures.exists('playerTexture')) {
            this.initializePlayerWithBase64Texture();
        } else {
            this.generateSprite().catch((error) => {
                console.error("Failed to load player sprite:", error);
                this.initializePlayerWithFallback();
            });
        }

        this.updateDialogue();

        this.dialogueBox = this.add.rectangle(0, this.scale.height - 80, this.scale.width, 80, 0x000000, 1).setOrigin(0, 0);
        this.dialogueBox.setVisible(false);

        this.dialogueText = this.add.text(20, this.scale.height - 70, '', {
            fontSize: '16px',
            color: '#ffffff',
            wordWrap: { width: this.scale.width - 40 },
        });
        this.dialogueText.setVisible(false);

        EventBus.emit('current-scene-ready', this);
    }

    update(): void {
        if (this.dialogueManager.isDialogueActive() || this.isInCombat) {
            this.player.setVelocity(0, 0);
            return;
        }

        if (this.wasd) {
            const { left, right, up, down } = this.wasd;
            if (left.isDown && !right.isDown && !up.isDown && !down.isDown) {
                this.player.setVelocity(-200, 0);
                this.player.play('left', true);
            } else if (right.isDown && !left.isDown && !up.isDown && !down.isDown) {
                this.player.setVelocity(200, 0);
                this.player.play('right', true);
            } else if (up.isDown && !down.isDown && !left.isDown && !right.isDown) {
                this.player.setVelocity(0, -200);
                this.player.play('up', true);
            } else if (down.isDown && !up.isDown && !left.isDown && !right.isDown) {
                this.player.setVelocity(0, 200);
                this.player.play('down', true);
            } else {
                this.player.setVelocity(0, 0);
                this.handleIdleAnimations();
            }
        }

    }

    private handleIdleAnimations(): void {
        const currentAnimation = this.player.anims.currentAnim?.key;
        if (currentAnimation === 'left') {
            this.player.play('idle-left');
        } else if (currentAnimation === 'right') {
            this.player.play('idle-right');
        } else if (currentAnimation === 'up') {
            this.player.play('idle-up');
        } else if (currentAnimation === 'down') {
            this.player.play('idle-down');
        }
    }

    private handleAnimations(): void {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0);
        this.background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'background1').setAlpha(1);

        this.anims.create({
            key: 'down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('player', { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('player', { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'up',
            frames: this.anims.generateFrameNumbers('player', { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-down',
            frames: [{ key: 'player', frame: 1 }],
            frameRate: 1,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-left',
            frames: [{ key: 'player', frame: 5 }],
            frameRate: 1,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-right',
            frames: [{ key: 'player', frame: 9 }],
            frameRate: 1,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-up',
            frames: [{ key: 'player', frame: 13 }],
            frameRate: 1,
            repeat: -1,
        });
    }
}
