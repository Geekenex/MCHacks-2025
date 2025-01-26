import { GumloopClient } from 'gumloop';
import Phaser from 'phaser';

export interface npc {
  sprite: Phaser.Physics.Arcade.Sprite;
  interacted: boolean;
  health: number;
  healthBar?: Phaser.GameObjects.Graphics;
}

export class CombatManager {
  private scene: Phaser.Scene;
  private npc: npc;
  private playerHP: number;
  private menuOptions: { name: string; type: 'offense' | 'defense' | 'wacky' }[] = [];
  private onCombatEnd: (result: { playerHP: number; npcWasKilled: boolean }) => void;
  private isPlayerTurn: boolean = true;
  private combatEnded: boolean = false;

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
        recipient: "josephambayec76@gmail.com",
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

  public playerAction(actionName: string) {
    if (!this.isPlayerTurn || this.combatEnded) return;

    const action = this.menuOptions.find((opt) => opt.name === actionName);
    if (!action) return;

    // role a 1/4 chance to miss a wacky attack

    let actionLog = '';


    switch (action.type) {
      case 'offense':
        this.npc.health -= 15;
        actionLog = `Player used ${actionName} and dealt 15 damage to the enemy!`;
        break;
      case 'defense':
        this.playerHP += 10;
        actionLog = `Player used ${actionName} and healed 10 HP!`;
        break;
      case 'wacky':
        const random = Math.random() * 4

        if (random <= 1) {
          actionLog = `Player used ${actionName} but missed!`;
          break;
        } else {

          this.npc.health -= 25;
          actionLog = `Player used ${actionName} and dealt 25 damage to the enemy!`;
          break;
        }

    }

    this.updateHealthBar();
    this.checkCombatOutcome();
    this.isPlayerTurn = false; // Switch to NPC's turn

    this.scene.events.emit('playerAction', actionLog);
  }

  public npcAction() {
    if (this.isPlayerTurn || this.combatEnded) return; // Prevent NPC action if not its turn or combat has ended

    const randomIndex = Math.floor(Math.random() * this.menuOptions.length);
    const selectedAction = this.menuOptions[randomIndex];
    let actionLog = '';

    switch (selectedAction.type) {
      case 'offense':
        this.playerHP -= 15;
        actionLog = `Enemy used ${selectedAction.name} and dealt 15 damage!`;
        break;
      case 'defense':
        this.npc.health += 10;
        this.updateHealthBar();
        actionLog = `Enemy used ${selectedAction.name} and healed 10 HP!`;
        break;
      case 'wacky':
        const random = Math.random() * 4

        if (random <= 1) {
          actionLog = `Enemy used ${selectedAction.name} but missed!`;
          break;
        } else {
          this.playerHP -= 25;
          actionLog = `Enemy used ${selectedAction.name} and dealt 25 damage!`;
          break;
        }
    }

    this.isPlayerTurn = true; // Switch back to player's turn
    this.scene.events.emit('npcAction', actionLog, this.playerHP);
    this.checkCombatOutcome();
  }

  private checkCombatOutcome() {
    if (this.npc.health <= 0) {
      this.combatEnded = true; // Set combat as ended
      this.onCombatEnd({ playerHP: this.playerHP, npcWasKilled: true });
    } else if (this.playerHP <= 0) {
      this.combatEnded = true; // Set combat as ended
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
