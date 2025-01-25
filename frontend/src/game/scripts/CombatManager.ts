import Phaser from 'phaser';

interface NPCData {
  sprite: Phaser.Physics.Arcade.Sprite;
  interacted: boolean;
  health: number;
  healthBar?: Phaser.GameObjects.Graphics;
}

export class CombatManager {
  private scene: Phaser.Scene;
  private npc: NPCData;
  private playerHP: number;
  private menuOptions: string[] = ['Rock', 'Paper', 'Scissors'];
  private currentSelection: number = 0;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private infoText: Phaser.GameObjects.Text;
  private inActionText: boolean = false;

  private keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    enter: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, npc: NPCData, playerHP: number) {
    this.scene = scene;
    this.npc = npc;
    this.playerHP = playerHP;

    // We'll listen for these keys in handleInput
    this.keys = {
      up: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      enter: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    };
  }

  public startCombat() {
    this.createHealthBar();
    this.createMenu();
    this.createInfoText();
    this.highlightSelection();

    // We'll run handleInput on each update
    this.scene.events.on('update', this.handleInput, this);
  }

  private createHealthBar() {
    this.npc.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
  }

  private updateHealthBar() {
    if (!this.npc.healthBar) return;
    this.npc.healthBar.clear();

    // Draw background
    this.npc.healthBar.fillStyle(0x000000, 1);
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, 60, 8);

    // Fill based on current NPC health
    this.npc.healthBar.fillStyle(0xff0000, 1);
    let width = (this.npc.health / 100) * 60;
    if (width < 0) width = 0;
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, width, 8);
  }

  private createMenu() {
    // You can adjust these positions as desired
    const startX = 100;
    const startY = 400;

    for (let i = 0; i < this.menuOptions.length; i++) {
      const text = this.scene.add.text(startX, startY + i * 30, this.menuOptions[i], {
        fontSize: '16px',
        color: '#ffffff',
      });
      this.menuTexts.push(text);
    }
  }

  private createInfoText() {
    this.infoText = this.scene.add
      .text(100, 350, '', { fontSize: '16px', color: '#ffff00' })
      .setVisible(false);
  }

  private handleInput() {
    // If we're currently showing action text, don't allow selecting
    if (this.inActionText) return;

    // Move selection up/down
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
    const playerChoice = this.menuOptions[this.currentSelection];
    this.showActionText(`Player chose ${playerChoice}!`, () => {
      // NPC picks randomly
      const npcChoice = this.getRandomChoice();
      this.showActionText(`NPC chose ${npcChoice}!`, () => {
        // Resolve RPS
        const winner = this.determineWinner(playerChoice, npcChoice);
        if (winner === 'player') {
          this.npc.health -= 20;
          this.updateHealthBar();
          this.showActionText(`You won this round!`, () => {
            if (this.npc.health <= 0) {
              this.endCombat(`NPC fainted!`);
              return;
            }
            this.inActionText = false; // ready for next selection
          });
        } else if (winner === 'npc') {
          this.playerHP -= 10;
          this.showActionText(`NPC won this round! Your HP: ${this.playerHP}`, () => {
            if (this.playerHP <= 0) {
              this.endCombat(`You fainted!`);
              return;
            }
            this.inActionText = false;
          });
        } else {
          // draw
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

    // Show message for 1.5s then callback
    this.scene.time.delayedCall(1500, () => {
      this.infoText.setVisible(false);
      onComplete();
    });
  }

  private endCombat(message: string) {
    this.showActionText(message, () => {
      // Cleanup
      this.npc.sprite.destroy();
      this.npc.healthBar?.destroy();
      this.menuTexts.forEach(t => t.destroy());
      this.scene.events.off('update', this.handleInput, this);
      this.infoText.destroy();
    });
  }

  private getRandomChoice(): string {
    const choices = ['Rock', 'Paper', 'Scissors'];
    const randomIndex = Math.floor(Math.random() * choices.length);
    return choices[randomIndex];
  }

  private determineWinner(
    playerChoice: string,
    npcChoice: string
  ): 'player' | 'npc' | 'draw' {
    if (playerChoice === npcChoice) {
      return 'draw';
    }
    if (
      (playerChoice === 'Rock' && npcChoice === 'Scissors') ||
      (playerChoice === 'Paper' && npcChoice === 'Rock') ||
      (playerChoice === 'Scissors' && npcChoice === 'Paper')
    ) {
      return 'player';
    }
    return 'npc';
  }
}
