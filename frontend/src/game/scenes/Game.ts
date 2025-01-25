import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: { up: Phaser.Input.Keyboard.Key, down: Phaser.Input.Keyboard.Key, left: Phaser.Input.Keyboard.Key, right: Phaser.Input.Keyboard.Key };

    constructor() {
        super('Game');
    }

    preload() {
        this.load.spritesheet('player', 'assets/player.png', {
            frameWidth: 256,
            frameHeight: 256,
        });

        this.load.image('background1', 'assets/background1.png');
    }

    create() {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0);

        this.background = this.add.image(512, 384, 'background1').setAlpha(0.5);

        this.anims.create({
            key: 'down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1,
        });

        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('player', { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1,
        });

        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('player', { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1,
        });

        this.anims.create({
            key: 'up',
            frames: this.anims.generateFrameNumbers('player', { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1,
        });

        this.anims.create({
            key: 'idle-down',
            frames: [{ key: 'player', frame: 1 }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'idle-left',
            frames: [{ key: 'player', frame: 5 }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'idle-right',
            frames: [{ key: 'player', frame: 9 }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'idle-up',
            frames: [{ key: 'player', frame: 13 }],
            frameRate: 1,
            repeat: -1,
        });

        this.player = this.physics.add.sprite(256, 256, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.play('idle-down');

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = {
                up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };
        }

        EventBus.emit('current-scene-ready', this);
    }

    update() {
        const movingLeft = this.cursors.left?.isDown || this.wasd.left.isDown;
        const movingRight = this.cursors.right?.isDown || this.wasd.right.isDown;
        const movingUp = this.cursors.up?.isDown || this.wasd.up.isDown;
        const movingDown = this.cursors.down?.isDown || this.wasd.down.isDown;

        if (movingLeft && !movingRight && !movingUp && !movingDown) {
            this.player.setVelocity(-200, 0);
            this.player.play('left', true);
        } else if (movingRight && !movingLeft && !movingUp && !movingDown) {
            this.player.setVelocity(200, 0);
            this.player.play('right', true);
        } else if (movingUp && !movingDown && !movingLeft && !movingRight) {
            this.player.setVelocity(0, -200);
            this.player.play('up', true);
        } else if (movingDown && !movingUp && !movingLeft && !movingRight) {
            this.player.setVelocity(0, 200);
            this.player.play('down', true);
        } else {
            this.player.setVelocity(0, 0);
            const currentAnimation = this.player.anims.currentAnim?.key;

            if (currentAnimation === 'left') {
                this.player.play('idle-left');
            } else if (currentAnimation === 'right') {
                this.player.play('idle-right');
            } else if (currentAnimation === 'up') {
                this.player.play('idle-up');
            } else if (currentAnimation === 'down') {
                this.player.play('idle-down');
            }
        }
    }
}
