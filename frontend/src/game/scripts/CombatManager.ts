import { GumloopClient } from 'gumloop';
import Phaser from 'phaser';

interface NPCData {
  sprite: Phaser.Physics.Arcade.Sprite;
  interacted: boolean;
  health: number;
  healthBar?: Phaser.GameObjects.Graphics;
}

const DAMAGE_TAKEN = 10;
const DAMAGE_DEALT = 100;

const COMBAT_TEXT_DELAY = 1600;

export class CombatManager {
  private scene: Phaser.Scene;
  private npc: NPCData;
  private playerHP: number;
  private menuOptions: { name: string; type: 'offense' | 'defense' | 'wacky' }[] = [];
  private currentSelection: number = 0;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private infoText: Phaser.GameObjects.Text;
  private inActionText: boolean = false;
  private onCombatEnd: (result: { playerHP: number; npcWasKilled: boolean }) => void;

  private keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    enter: Phaser.Input.Keyboard.Key;
  };

  constructor(
    scene: Phaser.Scene,
    npc: NPCData,
    playerHP: number,
    onCombatEnd: (result: { playerHP: number; npcWasKilled: boolean }) => void

  ) {
    this.scene = scene;
    this.npc = npc;
    this.playerHP = playerHP;
    this.onCombatEnd = onCombatEnd;

    this.keys = {
      up: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      enter: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    };
  }

  public async startCombat(promptText: string) {
    await this.fetchMenuOptionsFromGumloop(promptText);
    this.createHealthBar();
    this.createMenu();
    this.createInfoText();
    this.highlightSelection();

    this.scene.events.on('update', this.handleInput, this);
  }

  private async fetchMenuOptionsFromGumloop(promptText: string) {
    const client = new GumloopClient({
      apiKey: `${import.meta.env.VITE_COMBAT_API_KEY}`,
      userId: `${import.meta.env.VITE_COMBAT_USER_ID}`,
    });

    try {
      const output = await client.runFlow(`${import.meta.env.VITE_COMBAT_FLOW_ID}`, {
        recipient: "josephambayec76@gmail.com",
        prompt: "Create 3 abilities off the following prompt, use your imagination as to what abilities what would be available for this theme of game: " + promptText,
      });

      const generatedOutput = JSON.parse(output.output);

      this.menuOptions = [
        { name: generatedOutput.offense, type: 'offense' },
        { name: generatedOutput.defense, type: 'defense' },
        { name: generatedOutput.wacky, type: 'wacky' },
      ];
    } catch (error) {
      console.error("Failed to fetch menu options from Gumloop API:", error);

      this.menuOptions = [
        { name: "Basic Attack", type: 'offense' },
        { name: "Defend", type: 'defense' },
        { name: "Taunt", type: 'wacky' },
      ];
    }
  }

  private createHealthBar() {
    this.npc.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
  }

  private updateHealthBar() {
    if (!this.npc.healthBar) return;
    this.npc.healthBar.clear();

    this.npc.healthBar.fillStyle(0x000000, 1);
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, 60, 8);

    this.npc.healthBar.fillStyle(0xff0000, 1);
    let width = (this.npc.health / 100) * 60;
    if (width < 0) width = 0;
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, width, 8);
  }

  private createMenu() {
    const startX = 100;
    const startY = 400;
    const lineSpacing = 50; // Spacing between lines

    for (let i = 0; i < this.menuOptions.length; i++) {
      const option = this.menuOptions[i];

      // Create the main attack name text
      const nameText = this.scene.add.text(startX, startY + i * lineSpacing, option.name, {
        fontSize: '16px',
        color: '#ffffff',
      });
      this.menuTexts.push(nameText);

      // Create the small "Type" label under the attack name
      this.scene.add.text(
        startX,
        startY + i * lineSpacing + 20, // Slightly below the name
        `Type: ${option.type.charAt(0).toUpperCase() + option.type.slice(1)}`, // Capitalize first letter
        {
          fontSize: '12px',
          color: '#aaaaaa', // Grey for smaller text
        }
      );
    }
  }

  private createInfoText() {
    this.infoText = this.scene.add
      .text(100, 350, '', { fontSize: '16px', color: '#ffff00' })
      .setVisible(false);
  }

  private handleInput() {
    if (this.inActionText) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
      this.currentSelection =
        (this.currentSelection - 1 + this.menuOptions.length) % this.menuOptions.length;
      this.highlightSelection();
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      this.currentSelection = (this.currentSelection + 1) % this.menuOptions.length;
      this.highlightSelection();
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      this.executeAction();
    }
  }

  private highlightSelection() {
    for (let i = 0; i < this.menuTexts.length; i++) {
      if (i === this.currentSelection) {
        this.menuTexts[i].setStyle({ color: '#ff0000' }); // highlight
      } else {
        this.menuTexts[i].setStyle({ color: '#ffffff' });
      }
    }
  }

  private executeAction() {
    const playerChoice = this.menuOptions[this.currentSelection].name;
    this.showActionText(`Player chose ${playerChoice}!`, () => {
      const npcChoice = this.getRandomChoice();
      this.showActionText(`NPC chose ${npcChoice.name}!`, () => {
        const winner = this.determineWinner(playerChoice, npcChoice.name);
        if (winner === 'player') {
          this.npc.health -= DAMAGE_DEALT;
          this.updateHealthBar();
          this.showActionText(`You won this round!`, () => {
            if (this.npc.health <= 0) {
              this.endCombat(`NPC fainted!`);
              return;
            }
            this.inActionText = false;
          });
        } else if (winner === 'npc') {
          this.playerHP -= DAMAGE_TAKEN;
          this.showActionText(`NPC won this round! Your HP: ${this.playerHP}`, () => {
            if (this.playerHP <= 0) {
              this.endCombat(`You fainted!`);
              return;
            }
            this.inActionText = false;
          });
        } else {
          this.showActionText(`It's a tie!`, () => {
            this.inActionText = false;
          });
        }
      });
    });
  }

  private showActionText(message: string, onComplete: () => void) {
    this.inActionText = true;
    this.infoText.setText(message);
    this.infoText.setVisible(true);

    this.scene.time.delayedCall(COMBAT_TEXT_DELAY, () => {
      this.infoText.setVisible(false);
      onComplete();
    });
  }

  private endCombat(message: string) {
    this.showActionText(message, () => {
      const npcWasKilled = this.npc.health <= 0;
      this.npc.sprite.destroy();
      this.npc.healthBar?.destroy();
      this.menuTexts.forEach((t) => t.destroy());
      this.scene.events.off('update', this.handleInput, this);
      this.infoText.destroy();

      this.onCombatEnd({
        playerHP: this.playerHP,
        npcWasKilled,
      });
    });
  }

  private getRandomChoice(): { name: string; type: 'offense' | 'defense' | 'wacky' } {
    const randomIndex = Math.floor(Math.random() * this.menuOptions.length);
    return this.menuOptions[randomIndex];
  }

  private determineWinner(
    playerChoice: string,
    npcChoice: string
  ): 'player' | 'npc' | 'draw' {
    const beats = {
      offense: 'wacky',
      wacky: 'defense',
      defense: 'offense',
    };

    const playerType = this.getAttackType(playerChoice);
    const npcType = this.getAttackType(npcChoice);

    if (playerType === npcType) {
      return 'draw';
    }

    if (beats[playerType] === npcType) {
      return 'player';
    }

    return 'npc';
  }

  private getAttackType(choice: string): 'offense' | 'defense' | 'wacky' {
    const option = this.menuOptions.find((opt) => opt.name === choice);
    if (option) {
      return option.type;
    }

    console.error(`Unrecognized attack: "${choice}". Defaulting to "wacky".`);
    return 'wacky'; // Default fallback
  }
}
