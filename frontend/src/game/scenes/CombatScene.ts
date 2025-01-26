import Phaser from 'phaser';
import { CombatManager } from '../scripts/CombatManager';

interface ICombatData {
  playerHP: number;
  npcData: {
    health: number;
  };
  npcIndex: number;
}

export class CombatScene extends Phaser.Scene {
  private playerHP: number;
  private npcData: { health: number };
  private npcIndex: number;
  private combatManager: CombatManager;
  private npcSprite: Phaser.GameObjects.Sprite;

  constructor() {
    super('CombatScene');
  }

  init(data: ICombatData) {
    this.playerHP = data.playerHP;
    this.npcData = data.npcData;
    this.npcIndex = data.npcIndex;
  }

  preload() {
    this.load.image('combatBG', 'assets/combatBG.png');
    this.load.image('playerBattleSprite', 'assets/playerBattleSprite.png');
    this.load.image('npcBattleSprite', 'assets/npcBattleSprite.png');
  }

  create() {
    this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'combatBG')
      .setOrigin(0.5)
      .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

    const playerSprite = this.add.sprite(200, 300, 'playerBattleSprite').setScale(0.6);

    this.npcSprite = this.add.sprite(600, 250, 'npcBattleSprite').setScale(0.6);

    const npcDataForCombat = {
      sprite: this.npcSprite as unknown as Phaser.Physics.Arcade.Sprite, // Casting for compatibility
      interacted: true,
      health: this.npcData.health
    };

    this.combatManager = new CombatManager(
      this,
      npcDataForCombat,
      this.playerHP,
      (result: { playerHP: number; npcWasKilled: boolean }) => {
        this.playerHP = result.playerHP;

        // Start the Game scene and pass back necessary data
        this.scene.start('Game', {
          playerHP: this.playerHP,
          npcIndexToRemove: this.npcIndex,
          npcWasKilled: result.npcWasKilled,
        });
      }
    );

    // Start the battle
    this.combatManager.startCombat();
  }
}
