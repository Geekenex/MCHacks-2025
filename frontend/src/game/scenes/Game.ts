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
    dialogue: { speaker: string; text: string }[] = [];
    currentLineIndex: number;
    dialogueActive: boolean;
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
        }


        // Handle Defeated NPCs
        if (data.npcWasKilled && data.npcIndexToRemove !== undefined) {
            const npcIdToRemove = data.npcIndexToRemove;
            const npcToRemoveIndex = Game.npcsState.findIndex(npc => npc.id === npcIdToRemove);
            if (npcToRemoveIndex !== -1) {
                Game.npcsState.splice(npcToRemoveIndex, 1);
                Game.defeatedNpcIds.push(npcIdToRemove);
                console.log(`NPC with ID ${npcIdToRemove} marked as defeated and removed from state.`);

                // Additionally, find and destroy the sprite if it exists
                const npcToRemove = this.npcs.find(npc => npc.id === npcIdToRemove);
                if (npcToRemove && npcToRemove.sprite) {
                    npcToRemove.sprite.destroy();
                    console.log(`NPC sprite with ID ${npcIdToRemove} destroyed.`);
                }
            } else {
                console.warn(`No NPC found with ID ${npcIdToRemove} in state.`);
            }
        }

        // Update Player Position if provided
        if (data.playerPosition) {
            Game.playerPosition = data.playerPosition;
            console.log(`Player position set to: (${Game.playerPosition.x}, ${Game.playerPosition.y})`);
        }
    }

    preload() {
        console.log("preload")

        

        //this.load.spritesheet('player', 'assets/player.png', { frameWidth: 256, frameHeight: 256 });
        
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

    updateDialogue() {
        this.dialogueManager = new DialogueManager(this, this.dialogueLines, () => {
            if (this.currentNpc) {
                this.isInCombat = true;

                console.log(`Starting CombatScene with NPC ID: ${this.currentNpc.id}`);
                this.cameras.main.shake(2000, 0.01, true); // 2-second shake for the swirl effect
                this.time.delayedCall(2000, () => {
                    this.scene.start('CombatScene', {
                        playerHP: this.playerHPInstance,
                        npcIndexToRemove: this.currentNpc!.id, // Pass NPC ID
                        npcWasKilled: true,
                        npcData: { health: this.currentNpc!.health },
                        prompt: this.inputPrompt,
                        playerPosition: { x: this.player.x, y: this.player.y } // Pass player's current position
                    });
                });

                this.generateNewDialogue(this.inputPrompt);
            }
        });
    }

    async generateSprite() {
        const client = new GumloopClient({
            apiKey: `${import.meta.env.VITE_SPRITE_API_KEY}`,
            userId: `${import.meta.env.VITE_SPRITE_USER_ID}`,
        });
    
        // Run a flow and wait for outputs
        try {
            const sprite = await client.runFlow(`${import.meta.env.VITE_SPRITE_FLOW_ID}`, {
                prompt: this.inputPrompt,
            });
            console.log(sprite.output)
            return String(sprite.output); // Return the sprite output
        } catch (error) {
            console.error("Flow execution failed:", error);
            throw error; // Rethrow the error to allow handling by the caller
        }
    }

    create() {
        this.handleAnimations();

        // Initialize player at provided position or default
        const startX = Game.playerPosition.x;
        const startY = Game.playerPosition.y;

        this.player = this.physics.add.sprite(startX, startY, 'player');
        this.player.setScale(1);
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

        // Handle World Bounds for Transitions
        this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean, left: boolean, right: boolean) => {
            if (body.gameObject === this.player) {
                this.handleTransition(up, down, left, right);
            }
        });

        // Clear existing NPCs before creating new ones
        this.clearAllNPCs();

        // Initialize NPCs based on current state
        if (Game.npcsState.length === 0) {
            // If no NPCs in state, spawn initial NPCs
            const initialNumberOfNPCs = Phaser.Math.Between(1, 5);
            console.log(`Spawning initial ${initialNumberOfNPCs} NPC(s).`);
            this.spawnInitialNPCs(initialNumberOfNPCs);
        } else {
            // Create NPCs from existing state
            console.log(`Creating NPCs from saved state.`);
            this.createNPCsFromState();
        }

        // Initialize Input Controls
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

    /**
     * Generates a random position within the game bounds, ensuring it's outside the buffer zone around the player.
     */
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
                    return Phaser.Math.Distance.Between(x, y, npc.x, npc.y) < 50;
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
     * Spawns initial NPCs and updates the static npcsState.
     * @param numberOfNPCs - The number of NPCs to spawn initially.
     */
    private spawnInitialNPCs(numberOfNPCs: number) {
        for (let i = 0; i < numberOfNPCs; i++) {
            const npcId = Game.nextNpcId++;
            const newPos = this.getRandomPosition();
            const sprite = this.physics.add.sprite(newPos.x, newPos.y, 'npc');
            sprite.setOrigin(0.5, 0.5);
            sprite.setImmovable(true);
            sprite.setScale(0.2);
            if (sprite.body) {
                sprite.body.setSize(32, 32);
            }

            const npcData: NPCData = {
                id: npcId,
                x: newPos.x,
                y: newPos.y,
                sprite,
                interacted: false,
                health: 100,
                defeated: false,
            };

            this.physics.add.overlap(this.player, sprite, () => {
                this.handleNpcOverlap(npcData);
            });

            this.npcs.push(npcData);
            Game.npcsState.push(npcData);
        }

        console.log(`Spawned ${this.npcs.length} initial NPC(s).`);
    }

    /**
     * Creates NPC sprites based on the static npcsState.
     */
    private createNPCsFromState() {
        Game.npcsState.forEach(npcData => {
            if (npcData.defeated) return; // Skip defeated NPCs

            const sprite = this.physics.add.sprite(npcData.x, npcData.y, 'npc');
            sprite.setOrigin(0.5, 0.5);
            sprite.setImmovable(true);
            sprite.setScale(0.2);
            if (sprite.body) {
                sprite.body.setSize(32, 32);
            }

            this.physics.add.overlap(this.player, sprite, () => {
                this.handleNpcOverlap(npcData);
            });

            npcData.sprite = sprite;
            this.npcs.push(npcData);
        });

        console.log(`Created ${this.npcs.length} NPC(s) from state.`);
    }
/**
 * Spawns a specified number of NPCs with random positions, avoiding the player's starting area.
 * @param numberOfNPCs - The number of NPCs to spawn.
 */
private spawnNPCs(numberOfNPCs: number): void {
  for (let i = 0; i < numberOfNPCs; i++) {
      // Assign unique IDs using the static counter
      const npcId = Game.nextNpcId++;

      // Skip spawning if the NPC ID is in the defeated list
      if (Game.defeatedNpcIds.includes(npcId)) {
          console.log(`NPC ID ${npcId} is defeated. Skipping spawn.`);
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
          id: npcId,
          x: newPos.x,
          y: newPos.y,
          sprite,
          interacted: false,
          health: 100,
          defeated: false,
      };

      this.physics.add.overlap(this.player, sprite, () => {
          this.handleNpcOverlap(npcData);
      });

      this.npcs.push(npcData);
      Game.npcsState.push(npcData);
  }

  console.log(`Spawned ${this.npcs.length} NPC(s) on the screen.`);
}

    /**
     * Handles the overlap between the player and an NPC.
     * Initiates dialogue and combat if conditions are met.
     * @param npc - The NPC data object.
     */
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

    /**
     * Handles transitioning to a new stage/map when the player moves out of bounds.
     * @param up - Boolean indicating if the player moved up.
     * @param down - Boolean indicating if the player moved down.
     * @param left - Boolean indicating if the player moved left.
     * @param right - Boolean indicating if the player moved right.
     */
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

        this.clearAllNPCs();

        Game.npcsState = [];
        console.log(`Game state cleared for the new area.`);

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

            // Spawn new NPCs for the new area
            const numberOfNPCs = Phaser.Math.Between(1, 5);
            console.log(`Spawning ${numberOfNPCs} NPC(s) for the new area.`);
            this.spawnNPCs(numberOfNPCs);

            this.cameras.main.fadeIn(500, 0, 0, 0);
            this.isTransitioning = false;
        });
    }

    /**
     * Destroys all existing NPC sprites and clears the NPCs array.
     */
    private clearAllNPCs() {
        this.npcs.forEach(npc => {
            if (npc.sprite) {
                npc.sprite.destroy();
                console.log(`Destroyed NPC sprite with ID: ${npc.id}`);
            }
        });
        this.npcs = [];
        console.log(`All NPCs have been cleared from the game world.`);
    }

    /**
     * Sets up player animations.
     */
    private handleAnimations() {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0);
        this.background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'background1').setAlpha(1);

        this.anims.create({
            key: 'down',
            frames: this.anims.generateFrameNumbers('player', { start: 130, end: 139 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('player', { start: 117, end: 126 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('player', { start: 143, end: 152 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'up',
            frames: this.anims.generateFrameNumbers('player', { start: 104, end: 113 }),
            frameRate: 10,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-down',
            frames: [{ key: 'player', frame: 26 }],
            frameRate: 1,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-left',
            frames: [{ key: 'player', frame: 13 }],
            frameRate: 1,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-right',
            frames: [{ key: 'player', frame: 39 }],
            frameRate: 1,
            repeat: -1,
        });
        this.anims.create({
            key: 'idle-up',
            frames: [{ key: 'player', frame: 0 }],
            frameRate: 1,
            repeat: -1,
        });
    }
}
