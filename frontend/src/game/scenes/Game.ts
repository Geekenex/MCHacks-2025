import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { WorldManager } from '../scripts/WorldManager';
import { DialogueManager, DialogueLine } from '../scripts/DialogueManager';

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
    dialogueBox: Phaser.GameObjects.Rectangle;
    dialogueText: Phaser.GameObjects.Text;
    private isTransitioning: boolean = false;

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

    create() {
        this.handleAnimations();

        this.player = this.physics.add.sprite(256, 256, 'player');
        this.player.setScale(0.5); // Scale down to 128x128
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

        const npcPositions = [
            { x: 400, y: 256 },
            { x: 500, y: 300 },
            { x: 600, y: 256 },
        ];

        let nextNpcId = 0;

        npcPositions.forEach((pos, index) => {
            if (this.npcs[index]?.defeated) {
                console.log(`Skipping NPC ${index} (already defeated).`);
                return; // Skip NPC creation
            }

            const sprite = this.physics.add.sprite(pos.x, pos.y, 'npc');
            sprite.setOrigin(0.5, 0.5);
            sprite.setImmovable(true);
            sprite.setScale(0.2);
            if (sprite.body) {
                sprite.body.setSize(32, 32);
            }

            const npcData: NPCData = {
                id: nextNpcId++, // Assign unique ID
                sprite,
                interacted: false,
                health: 100,
                defeated: false,
            };

            this.physics.add.overlap(this.player, sprite, () => {
                this.handleNpcOverlap(npcData);
            });

            this.npcs.push(npcData);
        });

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = {
                up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };
        }

        const lines: DialogueLine[] = [
            { speaker: 'Player', text: 'Hello, NPC!' },
            { speaker: 'NPC', text: 'Hello, Player!' },
            { speaker: 'Player', text: 'Shall we battle?' },
            { speaker: 'NPC', text: 'Yes, let\'s do it!' },
        ];

        this.dialogueManager = new DialogueManager(this, lines, () => {
            if (this.currentNpc) {
                this.isInCombat = true;

                const npcIndex = this.npcs.indexOf(this.currentNpc);
                console.log(`Starting CombatScene with NPC Index: ${npcIndex}`);
                this.scene.start('CombatScene', {
                    playerHP: this.playerHP, // pass current player HP
                    npcIndex: npcIndex,
                    npcData: { health: this.currentNpc.health }, // pass NPC data
                });
            }
        });

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

    private handleNpcOverlap(npc: NPCData) {
        if (npc.interacted || this.dialogueManager.isDialogueActive()) return;

        npc.interacted = true;
        this.currentNpc = npc;

        console.log(`Player interacted with NPC. Starting dialogue.`);
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

            this.npcs.forEach((npc) => {
                npc.interacted = false;
            });

            this.cameras.main.fadeIn(500, 0, 0, 0);
            this.isTransitioning = false;
        });
    }

    private handleAnimations() {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0);
        this.background = this.add.image(1024-64, 768-192, 'background1').setAlpha(1);

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
