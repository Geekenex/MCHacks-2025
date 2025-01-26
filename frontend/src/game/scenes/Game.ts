import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { WorldManager } from '../scripts/WorldManager';
import { DialogueManager, DialogueLine } from '../scripts/DialogueManager';
import { GumloopClient } from "gumloop";

interface NPCData {
    id: number;
    sprite: Phaser.Physics.Arcade.Sprite;
    interacted: boolean;
    health: number;
    healthBar?: Phaser.GameObjects.Graphics;
    defeated: boolean;
}

interface GameInitData {
    playerHP?: number;
    npcIndexToRemove?: number;
    npcWasKilled?: boolean;
    input?: string;
}

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
    npcs: NPCData[] = [];
    dialogueManager: DialogueManager;
    currentNpc: NPCData | null = null;
    playerHP: number = 100;
    isInCombat: boolean = false;
    dialogue: { speaker: string; text: string }[] = [];
    currentLineIndex: number;
    dialogueActive: boolean;
    dialogueLines: DialogueLine[] = [];
    dialogueBox: Phaser.GameObjects.Rectangle;
    dialogueText: Phaser.GameObjects.Text;
    private isTransitioning: boolean = false;
    inputPrompt: String;

    //buffer distance to avoid spawning NPCs too close to the player
    private npcSpawnBuffer: number = 150;

    constructor() {
        super('Game');
    }

    init(data: GameInitData) {
        console.log(`Game scene init with data:`, data);
        if (data.playerHP !== undefined) {
            this.playerHP = data.playerHP;
            console.log(`Player HP updated to: ${this.playerHP}`);
        }

        this.isInCombat = false;

        if (data.input) {
            console.log(`Received input from MainMenu: ${data.input}`);
            this.generateNewDialogue(data.input);
            this.inputPrompt = data.input;
        }

        if (data.npcWasKilled && data.npcIndexToRemove !== undefined) {
            const npcToRemove = this.npcs[data.npcIndexToRemove];
            if (npcToRemove) {
                npcToRemove.sprite.destroy();
                npcToRemove.defeated = true;
                console.log(`NPC at index ${data.npcIndexToRemove} marked as defeated.`);
            } else {
                console.warn(`No NPC found at index ${data.npcIndexToRemove}`);
            }
        }
    }

    preload() {
        this.load.spritesheet('player', 'assets/player.png', { frameWidth: 256, frameHeight: 256 });
        this.load.spritesheet('npc', 'assets/npc.png', { frameWidth: 512, frameHeight: 512 });
        this.load.image('background1', 'assets/background1.png');
    }

    generateNewDialogue(input: String)  {
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

                const dialogueLines: DialogueLine[] = JSON.parse(jsonString);
                console.log('Dialogue lines:', dialogueLines);
                this.dialogueLines = dialogueLines;
            } catch (error) {
                console.error("Failed to generate dialogue:", error);
            }
        };

        runFlow();
    }

    runFlow() {
    }

    updateDialogue() {
      this.dialogueManager = new DialogueManager(this, this.dialogueLines, () => {
        if (this.currentNpc) {
            this.isInCombat = true;
  
            const npcIndex = this.npcs.indexOf(this.currentNpc);
            console.log(`Starting CombatScene with NPC Index: ${npcIndex}`);
            this.cameras.main.shake(2000, 0.01, true); // 2-second shake for the swirl effect
            this.time.delayedCall(2000, () => {
                this.scene.start('CombatScene', {
                    playerHP: this.playerHP,
                    npcIndex: npcIndex,
                    npcData: { health: this.currentNpc!.health }, 
                    prompt: this.inputPrompt,
                    playerPosition: { x: this.player.x, y: this.player.y }
                });
            });

            this.generateNewDialogue(this.inputPrompt);
        }
      });
    }

    create() {
        this.handleAnimations();
    
        // Reset player to initial overworld position
        this.player = this.physics.add.sprite(256, 256, 'player');
        this.player.setScale(0.5);
        this.player.setCollideWorldBounds(true);
        this.player.play('idle-down');
        this.physics.world.enable(this.player);
        if (this.player.body) {
            this.player.setCollideWorldBounds(true, 0, 0, true);
            const newBodyWidth = 128;
            const newBodyHeight = 128;
            this.player.body.setSize(newBodyWidth, newBodyHeight);
            this.player.body.setOffset((256 - newBodyWidth) / 2, (256 - newBodyHeight) / 2);
        }

        this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean, left: boolean, right: boolean) => {
            if (body.gameObject === this.player) {
                this.handleTransition(up, down, left, right);
            }
        });

        // Initialize NPCs with random positions
        this.spawnNPCs();

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = {
                up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };
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

    update() {
        if (this.dialogueManager.isDialogueActive() || this.isInCombat) {
            this.player.setVelocity(0, 0);
            return;
        }

        const movingLeft = this.wasd.left.isDown;
        const movingRight = this.wasd.right.isDown;
        const movingUp = this.wasd.up.isDown;
        const movingDown = this.wasd.down.isDown;

        if (movingLeft && !movingRight && !movingUp && !movingDown) {
            this.player.setVelocity(-200, 0);
            this.player.play('left', true);
        } else if (movingRight && !movingLeft && !movingUp && !movingDown) {
            this.player.setVelocity(200, 0);
            this.player.play('right', true);
        } else if (movingUp && !movingDown && !movingLeft && !movingRight) {
            this.player.setVelocity(0, -200);
            this.player.play('up', true);
        } else if (movingDown && !movingUp && !movingLeft && !movingRight) {
            this.player.setVelocity(0, 200);
            this.player.play('down', true);
        } else {
            this.player.setVelocity(0, 0);
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
    }

    private getRandomPosition(buffer: number = this.npcSpawnBuffer): {x: number, y: number} {
        const maxAttempts = 100;
        let attempts = 0;
        let position: {x: number, y: number};

        do {
            const x = Phaser.Math.Between(50, this.scale.width - 50);
            const y = Phaser.Math.Between(50, this.scale.height - 50);
            const distance = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);

            if (distance >= buffer) {
                position = { x, y };
                // Optionally, check for overlap with other NPCs
                const overlapping = this.npcs.some(npc => {
                    return Phaser.Math.Distance.Between(x, y, npc.sprite.x, npc.sprite.y) < 50;
                });
                if (!overlapping) {
                    return position;
                }
            }

            attempts++;
            if (attempts > maxAttempts) {
                console.warn("Max attempts reached while generating NPC position.");
                break;
            }
        } while (true);

        return { x: this.player.x + buffer + 10, y: this.player.y + buffer + 10 };
    }

    /**
     * Initializes NPCs with random positions, avoiding the player's starting area.
     */
    private spawnNPCs() {
        const numberOfNPCs = 3;
        let nextNpcId = this.npcs.length;

        for (let i = 0; i < numberOfNPCs; i++) {
            if (this.npcs[i] && !this.npcs[i].defeated) {
                const newPos = this.getRandomPosition();
                this.npcs[i].sprite.setPosition(newPos.x, newPos.y);
                this.npcs[i].interacted = false;
                continue;
            }

            const newPos = this.getRandomPosition();
            const sprite = this.physics.add.sprite(newPos.x, newPos.y, 'npc');
            sprite.setOrigin(0.5, 0.5);
            sprite.setImmovable(true);
            sprite.setScale(0.2);
            if (sprite.body) {
                sprite.body.setSize(32, 32);
            }

            const npcData: NPCData = {
                id: nextNpcId++,
                sprite,
                interacted: false,
                health: 100,
                defeated: false,
            };

            this.physics.add.overlap(this.player, sprite, () => {
                this.handleNpcOverlap(npcData);
            });

            this.npcs.push(npcData);
        }
    }

    /**
     * Shuffles the positions of existing NPCs when new land is generated.
     */
    private shuffleNPCPositions() {
        this.npcs.forEach(npc => {
            if (npc.defeated) return;

            const newPos = this.getRandomPosition();
            npc.sprite.setPosition(newPos.x, newPos.y);
            npc.interacted = false;
        });
    }

    private handleNpcOverlap(npc: NPCData) {
        if (npc.interacted || this.dialogueManager.isDialogueActive()) return;

        if (!this.dialogueLines || this.dialogueLines.length === 0) {
            console.warn("No dialogue lines available for this NPC.");
            return;
        }

        npc.interacted = true;
        this.currentNpc = npc;

        console.log(`Player interacted with NPC. Starting dialogue.`);
        this.updateDialogue();
        this.dialogueManager.startDialogue();
    }

    private handleTransition(up: boolean, down: boolean, left: boolean, right: boolean) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;

        const bufferX = 64 + 10;
        const bufferY = 64 + 10;

        let direction: keyof typeof WorldManager.maps | null = null;

        if (left) direction = 'leftMap';
        else if (right) direction = 'rightMap';
        else if (up) direction = 'upMap';
        else if (down) direction = 'downMap';

        if (!direction) {
            this.isTransitioning = false;
            return;
        }

        WorldManager.generateMaps(direction);

        this.cameras.main.fadeOut(500, 0, 0, 0);

        if (this.player.body) this.player.body.checkCollision.none = true;

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.background.setTexture(WorldManager.maps.currentMap);

            if (direction === 'leftMap') {
                this.player.x = gameWidth - bufferX;
                this.player.y = Phaser.Math.Clamp(this.player.y, bufferY, gameHeight - bufferY);
            } else if (direction === 'rightMap') {
                this.player.x = bufferX;
                this.player.y = Phaser.Math.Clamp(this.player.y, bufferY, gameHeight - bufferY);
            } else if (direction === 'upMap') {
                this.player.y = gameHeight - bufferY;
                this.player.x = Phaser.Math.Clamp(this.player.x, bufferX, gameWidth - bufferX);
            } else if (direction === 'downMap') {
                this.player.y = bufferY;
                this.player.x = Phaser.Math.Clamp(this.player.x, bufferX, gameWidth - bufferX);
            }

            this.player.setVelocity(0, 0);

            if (this.player.body) this.player.body.checkCollision.none = false;

            // Shuffle NPC positions after transitioning to new land
            this.shuffleNPCPositions();

            this.cameras.main.fadeIn(500, 0, 0, 0);
            this.isTransitioning = false;
        });
    }

    private handleAnimations() {
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
