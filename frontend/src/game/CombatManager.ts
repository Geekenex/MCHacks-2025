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
  private rpsOptions: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, npc: NPCData, playerHP: number) {
    this.scene = scene;
    this.npc = npc;
    this.playerHP = playerHP;
  }

  public startCombat() {
    this.createHealthBar();
    this.showRPSOptions();
  }

  private createHealthBar() {
    this.npc.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
  }

  private updateHealthBar() {
    if (!this.npc.healthBar) return;
    this.npc.healthBar.clear();

    // Background bar
    this.npc.healthBar.fillStyle(0x000000, 1);
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, 60, 8);

    // Health fill
    this.npc.healthBar.fillStyle(0xff0000, 1);
    let width = (this.npc.health / 100) * 60;
    if (width < 0) width = 0;
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, width, 8);
  }

  private showRPSOptions() {
    const options = ['Rock', 'Paper', 'Scissors'];

    for (let i = 0; i < options.length; i++) {
      const text = this.scene.add
        .text(100 + i * 100, 100, options[i], { color: '#ffffff' })
        .setInteractive()
        .on('pointerdown', () => {
          this.handlePlayerChoice(options[i]);
        });

      this.rpsOptions.push(text);
    }
  }

  private handlePlayerChoice(playerChoice: string) {
    const npcChoice = this.getRandomChoice();
    const winner = this.determineWinner(playerChoice, npcChoice);

    // If player wins, deal half of player's HP as damage
    if (winner === 'player') {
      this.npc.health -= this.playerHP / 2;
      this.updateHealthBar();

      // End combat if NPC health is 0 or below
      if (this.npc.health <= 0) {
        this.endCombat();
      }
    }
  }

  private endCombat() {
    this.npc.sprite.destroy();
    this.npc.healthBar?.destroy();
    this.rpsOptions.forEach(text => text.destroy());
  }

  private getRandomChoice(): string {
    const choices = ['Rock', 'Paper', 'Scissors'];
    const randomIndex = Math.floor(Math.random() * choices.length);
    return choices[randomIndex];
  }

  private determineWinner(playerChoice: string, npcChoice: string): 'player' | 'npc' | 'draw' {
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