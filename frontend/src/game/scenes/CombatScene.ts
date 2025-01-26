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

  private actionNames: string[] = ['Attack', 'Defend', 'Special'];
  private selectedIndex = 0;

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
      this.updateCombatLog.bind(this)
    );

    this.combatManager.startCombat(this.prompt, (menuOptions) => {
      this.actionNames = menuOptions.map((option) => option.name);
      this.createCombatMenu();
    });

    this.events.on('npcAction', this.handleNPCAction, this); // Listen for NPC actions
  }

  private createCombatMenu() {
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
      this.selectedIndex = (this.selectedIndex - 1 + this.actionNames.length) % this.actionNames.length;
      this.highlightSelectedOption();
    });

    this.input.keyboard?.on('keydown-S', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.actionNames.length;
      this.highlightSelectedOption();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      const selectedAction = this.actionNames[this.selectedIndex];
      this.handleCombatOption(selectedAction);
    });
  }

  private handleCombatOption(option: string) {
    switch (option) {
      case this.actionNames[0]:
        this.combatManager.playerAction('attack');
        this.addCombatLog(`Player used ${option}`);
        break;
      case this.actionNames[1]:
        this.combatManager.playerAction('defend');
        this.addCombatLog(`Player used ${option}`);
        break;
      case this.actionNames[2]:
        this.combatManager.playerAction('special');
        this.addCombatLog(`Player used ${option}`);
        break;
    }

    this.updatePlayerHealthBar();

    this.time.delayedCall(1000, () => {
      const npcLog = this.combatManager.npcAction();
      if (npcLog) this.addCombatLog(npcLog);
    });
  }

  private handleNPCAction(actionLog: string, playerHP: number) {
    this.addCombatLog(actionLog);
    this.playerHP = playerHP;
    this.updatePlayerHealthBar();
  }

  private createResultBox() {
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
      wordWrap: { width: resultBoxWidth - 20 },
    });

    this.resultBox.add(resultText);
  }

  private updateCombatLog(message: { playerHP: number; npcWasKilled: boolean }) {
    const resultText = this.resultBox.getAt(1) as Phaser.GameObjects.Text;

    let logMessage = `Player HP: ${message.playerHP}\n`;
    logMessage += message.npcWasKilled ? 'NPC defeated!' : 'NPC still alive!';

    resultText.setText(`Combat Log:\n${logMessage}`);
  }

  private addCombatLog(message: string) {
    const resultText = this.resultBox.getAt(1) as Phaser.GameObjects.Text;
    let logLines = resultText.text.split('\n');
    const title = logLines[0];

    logLines.push(message);
    if (logLines.length > 6) {
      logLines = [title, ...logLines.slice(logLines.length - 5)];
    }

    resultText.setText(logLines.join('\n'));
  }
}
