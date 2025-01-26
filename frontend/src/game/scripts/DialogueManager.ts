import Phaser from 'phaser';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export class DialogueManager {
  private scene: Phaser.Scene;
  private lines: DialogueLine[];
  private currentLineIndex: number;
  private dialogueActive: boolean;
  private onDialogueComplete?: () => void;

  private dialogueBox: Phaser.GameObjects.Graphics;
  private dialogueText: Phaser.GameObjects.Text;
  private enterKey: Phaser.Input.Keyboard.Key;

  constructor(
    scene: Phaser.Scene,
    lines: DialogueLine[],
    onDialogueComplete?: () => void
  ) {
    this.scene = scene;
    this.lines = lines || [];
    this.onDialogueComplete = onDialogueComplete;
    this.currentLineIndex = 0;
    this.dialogueActive = false;

    this.dialogueBox = this.scene.add.graphics();
    this.dialogueBox.setDepth(1000);
    this.dialogueBox.setVisible(false);

    const boxMargin = 20;
    const boxWidth = this.scene.scale.width - boxMargin * 2;
    const boxHeight = 80;
    const boxX = boxMargin;
    const boxY = this.scene.scale.height - boxHeight - boxMargin;

    this.dialogueBox.fillStyle(0x000000, 0.8);
    this.dialogueBox.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
    this.dialogueBox.lineStyle(2, 0xffffff, 1);
    this.dialogueBox.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);

    this.dialogueText = this.scene.add.text(boxX + 15, boxY + 10, '', {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: boxWidth - 30 },
    });
    this.dialogueText.setDepth(1001);
    this.dialogueText.setVisible(false);
    

    if (this.scene.input && this.scene.input.keyboard) {
      this.enterKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }
    this.enterKey.on('down', () => {
      if (!this.dialogueActive) return;
      this.currentLineIndex++;
      if (this.currentLineIndex >= this.lines.length) {
        this.endDialogue();
      } else {
        const currentLine = this.lines[this.currentLineIndex];
        this.dialogueText.setText(`${currentLine.speaker}: ${currentLine.text}`);
      }
    });

    this.scene.input.on('pointerdown', () => {
      if (!this.dialogueActive) return;
      this.currentLineIndex++;
      if (this.currentLineIndex >= this.lines.length) {
        this.endDialogue();
      } else {
        this.dialogueText.setText(this.lines[this.currentLineIndex].text);
      }
    });
  }

  public startDialogue() {
    if (!this.lines || this.lines.length === 0) {
        console.warn('No dialogue lines available to start.');
        return;
    }

    this.dialogueActive = true;
    this.currentLineIndex = 0;

    const currentLine = this.lines[this.currentLineIndex];
    this.dialogueBox.setVisible(true);
    this.dialogueText.setText(`${currentLine.speaker}: ${currentLine.text}`);
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
