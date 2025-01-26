import Phaser from 'phaser';
import { CombatManager, npc } from '../scripts/CombatManager';

interface ICombatData {
  playerHP: number;
  npcData: npc;
  npcIndex: number;
  prompt: string;
  playerPosition: { x: number; y: number };
}

export class CombatScene extends Phaser.Scene {
  private playerHP: number;
  private npcData: npc;
  private npcIndex: number;
  private combatManager: CombatManager;
  private npcSprite: Phaser.GameObjects.Sprite;
  private playerSprite: Phaser.GameObjects.Sprite;
  private playerHealthBar: Phaser.GameObjects.Graphics;
  private prompt: string;
  private playerPosition: { x: number; y: number };
  private combatMenu: Phaser.GameObjects.Container;
  private resultBox: Phaser.GameObjects.Container;
  private combatLogs: string[] = [];

  private actionNames: string[] = [];
  private selectedIndex = 0;
  private turnInProgress: boolean = false;
  private combatEnded: boolean = false;

  private npcWasKilled: boolean = false;

  backgroundMusic: Phaser.Sound.BaseSound;

  constructor() {
    super('CombatScene');
  }

  init(data: ICombatData) {
    this.playerHP = data.playerHP;
    this.npcData = data.npcData;
    this.npcIndex = data.npcIndex;
    this.prompt = data.prompt;
    this.playerPosition = data.playerPosition;
  }

  preload() {
    this.load.image('combatBG', 'assets/combatBG.png');
    this.load.image('playerBattleSprite', 'assets/playerBattleSprite.png');
    this.load.image('npcBattleSprite', 'assets/npcBattleSprite.png');
  }

  create() {
    this.turnInProgress = false;
    this.combatEnded = false;

    this.backgroundMusic = this.sound.add('battle', { loop: true });
    this.backgroundMusic.play();

    this.cameras.main.fadeIn(1000, 0, 0, 0);

    this.add
      .image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'combatBG')
      .setOrigin(0.5)
      .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

    this.playerSprite = this.physics.add
      .sprite(this.cameras.main.width - 800, this.cameras.main.height - 150, 'playerBattleSprite')
      .setScale(0.6);

    this.npcSprite = this.physics.add
      .sprite(this.cameras.main.width - 250, 350, 'npcBattleSprite')
      .setScale(0.6);

    this.createPlayerHealthBar();
    this.createResultBox();

    this.combatManager = new CombatManager(
      this,
      {
        sprite: this.npcSprite as Phaser.Physics.Arcade.Sprite,
        interacted: true,
        health: this.npcData.health,
      },
      this.playerHP,
      this.handleCombatEnd.bind(this)
    );

    // Start fetching menu options during the fade-in
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'Loading...',
      { fontSize: '20px', color: '#ffffff' }
    ).setOrigin(0.5);

    this.combatManager.startCombat(this.prompt, (menuOptions) => {
      this.actionNames = menuOptions.map((option) => option.name);
      this.createCombatMenu();
    });

    // Clear and re-add event listeners
    this.events.off('npcAction');
    this.events.off('playerAction');

    this.events.on('npcAction', this.handleNPCAction, this);
    this.events.on('playerAction', this.handlePlayerAction, this);

    // Reset combat log on scene start
    this.resetCombatLog();
  }

  private resetCombatLog() {
    this.combatLogs = [];
    this.updateCombatLogUI();
  }

  private createCombatMenu() {
    if (this.combatMenu) {
      this.combatMenu.destroy();
    }

    const menuWidth = 350;
    const menuHeight = this.actionNames.length * 70 + 20;

    this.combatMenu = this.add.container(
      this.cameras.main.width - menuWidth - 20,
      this.cameras.main.height - menuHeight - 20
    );

    const menuBackground = this.add
      .rectangle(0, 0, menuWidth, menuHeight, 0x000000, 0.8)
      .setOrigin(0, 0);
    this.combatMenu.add(menuBackground);

    this.actionNames.forEach((action, index) => {
      const text = this.add
        .text(20, 20 + index * 70, action, {
          fontSize: '20px',
          color: '#ffffff',
        })
        .setInteractive();
      this.combatMenu.add(text);

      const type = this.combatManager.getAbilityType(action);
      const typeText = this.add
        .text(20, 45 + index * 70, `Type: ${type}`, {
          fontSize: '16px',
          color: '#aaaaaa',
        });
      this.combatMenu.add(typeText);
    });

    this.highlightSelectedOption();
    this.handleKeyboardInput();
  }

  private createPlayerHealthBar() {
    if (this.playerHealthBar) {
      this.playerHealthBar.destroy();
    }

    this.playerHealthBar = this.add.graphics();
    this.updatePlayerHealthBar();
  }

  private updatePlayerHealthBar() {
    this.playerHealthBar.clear();
    this.playerHealthBar.fillStyle(0x000000, 1);
    this.playerHealthBar.fillRect(this.playerSprite.x - 30, this.playerSprite.y - 60, 60, 8);

    const width = Math.max((this.playerHP / 100) * 60, 0);
    this.playerHealthBar.fillStyle(0x00ff00, 1);
    this.playerHealthBar.fillRect(this.playerSprite.x - 30, this.playerSprite.y - 60, width, 8);
  }

  private highlightSelectedOption() {
    const menuItems = this.combatMenu.getAll().filter((child) => child instanceof Phaser.GameObjects.Text);
    const actionTexts = menuItems.filter((_, index) => index % 2 === 0);

    actionTexts.forEach((child, index) => {
      if (child instanceof Phaser.GameObjects.Text) {
        child.setColor(index === this.selectedIndex ? '#ffff00' : '#ffffff');
        child.setFontStyle(index === this.selectedIndex ? 'bold' : 'normal');
      }
    });
  }

  private handleKeyboardInput() {
    this.input.keyboard?.on('keydown-W', () => {
      if (this.turnInProgress || this.combatEnded) return;
      this.selectedIndex = (this.selectedIndex - 1 + this.actionNames.length) % this.actionNames.length;
      this.highlightSelectedOption();
    });

    this.input.keyboard?.on('keydown-S', () => {
      if (this.turnInProgress || this.combatEnded) return;
      this.selectedIndex = (this.selectedIndex + 1) % this.actionNames.length;
      this.highlightSelectedOption();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.turnInProgress || this.combatEnded) return;
      const selectedAction = this.actionNames[this.selectedIndex];
      this.handleCombatOption(selectedAction);
    });
  }

  private handleCombatOption(option: string) {
    if (this.turnInProgress || this.combatEnded) return;
    this.turnInProgress = true;

    this.combatManager.playerAction(option, this.sound);

    this.updatePlayerHealthBar();

    this.time.delayedCall(1500, () => {
      if (!this.combatEnded) { // Only proceed if combat hasn't ended
        this.combatManager.npcAction();
        this.turnInProgress = false;
      }
    });
  }

  private handlePlayerAction(actionLog: string) {
    this.addCombatLog(actionLog);
  }

  private handleNPCAction(actionLog: string, playerHP: number) {
    this.addCombatLog(actionLog);
    this.playerHP = playerHP;
    this.updatePlayerHealthBar();
  }

  private handleCombatEnd(result: { playerHP: number; npcWasKilled: boolean }) {
    if (this.combatEnded) return; // Prevent duplicate endings
    this.combatEnded = true;

    this.sound.add('enemy_death').play();
    if (result.npcWasKilled) {
      this.addCombatLog('Player won the battle!');
      this.npcWasKilled = true;

    } else {
      this.addCombatLog('Player lost the battle...');
      this.npcWasKilled = false;
    }

    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(1000, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Game', { playerPosition: this.playerPosition, npcWasKilled: this.npcWasKilled, npcIndexToRemove: this.npcIndex });
        this.backgroundMusic.stop();
      });
    });
  }

  private createResultBox() {
    if (this.resultBox) {
      this.resultBox.destroy(); // Clean up existing result box
    }

    const resultBoxWidth = 400;
    const resultBoxHeight = 200;

    this.resultBox = this.add.container(20, 20);

    const resultBackground = this.add
      .rectangle(0, 0, resultBoxWidth, resultBoxHeight, 0x000000, 0.8)
      .setOrigin(0, 0);
    this.resultBox.add(resultBackground);

    const resultText = this.add.text(10, 10, 'Combat Log:\n', {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: 380 },
      lineSpacing: 10, // Increased line spacing
    });

    this.resultBox.add(resultText);
  }

  private addCombatLog(message: string) {
    this.combatLogs.push(message);
    this.updateCombatLogUI();
  }

  private updateCombatLogUI() {
    const resultText = this.resultBox.getAt(1) as Phaser.GameObjects.Text;
    const logText = ['Combat Log:', ...this.combatLogs.slice(-2)]
      .map((log) => `${log}`)
      .join('\n\n'); 

    resultText.setText(logText);
    resultText.setStyle({
      lineSpacing: 20,
    });
  }
}
