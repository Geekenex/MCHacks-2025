import Phaser from 'phaser';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export class DialogueManager {
  private scene: Phaser.Scene;
  private lines: DialogueLine[];
  private currentLineIndex: number;
  private dialogueBox: Phaser.GameObjects.Rectangle;
  private dialogueText: Phaser.GameObjects.Text;
  private dialogueActive: boolean;
  private onDialogueComplete?: () => void;

  constructor(
    scene: Phaser.Scene,
    lines: DialogueLine[],
    onDialogueComplete?: () => void
  ) {
    this.scene = scene;
    this.lines = lines;
    this.onDialogueComplete = onDialogueComplete;
    this.currentLineIndex = 0;
    this.dialogueActive = false;

    this.dialogueBox = this.scene.add
      .rectangle(0, this.scene.scale.height - 80, this.scene.scale.width, 80, 0x000000)
      .setOrigin(0, 0)
      .setVisible(false);

    this.dialogueText = this.scene.add
      .text(20, this.scene.scale.height - 70, '', {
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: this.scene.scale.width - 40 },
      })
      .setVisible(false);

    this.scene.input.on('pointerdown', () => {
      if (!this.dialogueActive) return;

      this.currentLineIndex++;

      if (this.currentLineIndex >= this.lines.length) {
        // End of dialogue
        this.endDialogue();
      } else {
        this.dialogueText.setText(this.lines[this.currentLineIndex].text);
      }
    });
  }

  public startDialogue() {
    this.dialogueActive = true;
    this.currentLineIndex = 0;
    this.dialogueBox.setVisible(true);
    this.dialogueText.setText(this.lines[this.currentLineIndex].text);
    this.dialogueText.setVisible(true);
  }

  private endDialogue() {
    this.dialogueActive = false;
    this.dialogueBox.setVisible(false);
    this.dialogueText.setVisible(false);

    if (this.onDialogueComplete) {
      this.onDialogueComplete();
    }
  }

  public isDialogueActive(): boolean {
    return this.dialogueActive;
  }
}