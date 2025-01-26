import { GumloopClient } from 'gumloop';
import Phaser from 'phaser';

export interface npc {
  sprite: Phaser.Physics.Arcade.Sprite;
  interacted: boolean;
  health: number;
  healthBar?: Phaser.GameObjects.Graphics;
}

const DAMAGE_TAKEN = 10;
const DAMAGE_DEALT = 100;

export class CombatManager {
  private scene: Phaser.Scene;
  private npc: npc;
  private playerHP: number;
  private menuOptions: { name: string; type: 'offense' | 'defense' | 'wacky' }[] = [];
  private onCombatEnd: (result: { playerHP: number; npcWasKilled: boolean }) => void;
  private isPlayerTurn: boolean = true;

  constructor(
    scene: Phaser.Scene,
    npc: npc,
    playerHP: number,
    onCombatEnd: (result: { playerHP: number; npcWasKilled: boolean }) => void
  ) {
    this.scene = scene;
    this.npc = npc;
    this.playerHP = playerHP;
    this.onCombatEnd = onCombatEnd;
  }

  public async startCombat(
    promptText: string,
    onOptionsGenerated: (menuOptions: { name: string; type: string }[]) => void
  ) {
    await this.fetchMenuOptionsFromGumloop(promptText);
    onOptionsGenerated(this.menuOptions);
    this.createHealthBar();
  }

  public async fetchMenuOptionsFromGumloop(promptText: string) {
    const client = new GumloopClient({
      apiKey: `${import.meta.env.VITE_COMBAT_API_KEY}`,
      userId: `${import.meta.env.VITE_COMBAT_USER_ID}`,
    });

    try {
      const output = await client.runFlow(`${import.meta.env.VITE_COMBAT_FLOW_ID}`, {
        prompt: `Create 3 abilities for this prompt: ${promptText}`,
      });

      const generatedOutput = JSON.parse(output.output);

      this.menuOptions = [
        { name: generatedOutput.offense, type: 'offense' },
        { name: generatedOutput.defense, type: 'defense' },
        { name: generatedOutput.wacky, type: 'wacky' },
      ];
    } catch (error) {
      console.error('Failed to fetch menu options from Gumloop API:', error);

      this.menuOptions = [
        { name: 'Basic Attack', type: 'offense' },
        { name: 'Defend', type: 'defense' },
        { name: 'Taunt', type: 'wacky' },
      ];
    }
  }

  getAbilityType(actionName: string): string {
    const action = this.menuOptions.find((opt) => opt.name === actionName);
    if (!action) return 'Unknown';

    switch (action.type) {
      case 'offense':
        return 'Normal Attack';
      case 'defense':
        return 'Defensive Stance';
      case 'wacky':
        return 'Special Attack';
      default:
        return 'Unknown';
    }
  }

  playerAction(type: 'attack' | 'defend' | 'special') {
    if (!this.isPlayerTurn) return;

    switch (type) {
      case 'attack':
        this.npc.health -= 15;
        break;
      case 'defend':
        this.playerHP += 10;
        break;
      case 'special':
        this.npc.health -= 25;
        break;
    }

    this.updateHealthBar();
    this.checkCombatOutcome();
    this.isPlayerTurn = false; // Switch to NPC's turn
  }

  npcAction(): string {
    if (this.isPlayerTurn) return '';

    const randomIndex = Math.floor(Math.random() * this.menuOptions.length);
    const selectedAction = this.menuOptions[randomIndex];
    let actionLog = '';

    switch (selectedAction.type) {
      case 'offense':
        this.playerHP -= 15;
        actionLog = `Enemy used ${selectedAction.name}! Player takes 20 damage.`;
        break;
      case 'defense':
        this.npc.health += 10;
        this.updateHealthBar();
        actionLog = `Enemy used ${selectedAction.name}! Enemy heals 10 HP.`;
        break;
      case 'wacky':
        this.playerHP -= 25;
        actionLog = `Enemy used ${selectedAction.name}! Player takes 30 damage.`;
        break;
    }

    this.isPlayerTurn = true; // Switch back to player's turn
    this.scene.events.emit('npcAction', actionLog, this.playerHP);
    this.checkCombatOutcome();
    return actionLog;
  }

  private checkCombatOutcome() {
    if (this.npc.health <= 0) {
      this.onCombatEnd({ playerHP: this.playerHP, npcWasKilled: true });
    } else if (this.playerHP <= 0) {
      this.onCombatEnd({ playerHP: 0, npcWasKilled: false });
    }
  }

  private createHealthBar() {
    if (!this.npc.sprite) return;

    this.npc.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
  }

  private updateHealthBar() {
    if (!this.npc.healthBar || !this.npc.sprite) return;

    this.npc.healthBar.clear();
    this.npc.healthBar.fillStyle(0x000000, 1);
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, 60, 8);

    const width = Math.max((this.npc.health / 100) * 60, 0);
    this.npc.healthBar.fillStyle(0xff0000, 1);
    this.npc.healthBar.fillRect(this.npc.sprite.x - 30, this.npc.sprite.y - 60, width, 8);
  }
}
