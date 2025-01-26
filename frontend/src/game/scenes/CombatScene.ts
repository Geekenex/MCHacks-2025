import Phaser from 'phaser';
import { CombatManager } from '../scripts/CombatManager';

interface ICombatData {
  playerHP: number;
  npcData: {
    health: number;
  };
  npcIndex: number;
  prompt: string;
  playerPosition: { x: number; y: number }; // Add player position
}

export class CombatScene extends Phaser.Scene {
  private playerHP: number;
  private npcData: { health: number };
  private npcIndex: number;
  private combatManager: CombatManager;
  private npcSprite: Phaser.GameObjects.Sprite;
  private playerSprite: Phaser.GameObjects.Sprite;
  private prompt: string;
  private playerPosition: { x: number; y: number }; // Store player's position

  constructor() {
    super('CombatScene');
  }

  init(data: ICombatData) {
    this.playerHP = data.playerHP;
    this.npcData = data.npcData;
    this.npcIndex = data.npcIndex;
    this.prompt = data.prompt;
    this.playerPosition = data.playerPosition; // Initialize the player position
  }

  preload() {
    this.load.image('combatBG', 'assets/combatBG.png');
    this.load.image('playerBattleSprite', 'assets/playerBattleSprite.png');
    this.load.image('npcBattleSprite', 'assets/npcBattleSprite.png');
  }

  create() {
    this.cameras.main.fadeIn(1000, 0, 0, 0); // Fade-in transition into CombatScene

    this.add
      .image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'combatBG')
      .setOrigin(0.5)
      .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

    // Player positioned at the bottom center
    this.playerSprite = this.add
      .sprite(this.cameras.main.width - 800, this.cameras.main.height - 150, 'playerBattleSprite')
      .setScale(0.6);

    // Enemy positioned at the top center
    this.npcSprite = this.add
      .sprite(this.cameras.main.width - 250, 350, 'npcBattleSprite')
      .setScale(0.6);

    const npcDataForCombat = {
      sprite: this.npcSprite as unknown as Phaser.Physics.Arcade.Sprite,
      interacted: true,
      health: this.npcData.health,
    };

    this.combatManager = new CombatManager(
      this,
      npcDataForCombat,
      this.playerHP,
      (result: { playerHP: number; npcWasKilled: boolean }) => {
        this.playerHP = result.playerHP;

        // Pass player position back to Game scene
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('Game', {
            playerHP: this.playerHP,
            npcIndexToRemove: this.npcIndex,
            npcWasKilled: result.npcWasKilled,
            playerPosition: this.playerPosition, // Pass the player position
          });
        });
      }
    );

    // Start the battle
    this.combatManager.startCombat(this.prompt);
  }
}
