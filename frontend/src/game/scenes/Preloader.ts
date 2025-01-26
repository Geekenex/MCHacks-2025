import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
        this.load.image('star', 'star.png');
        this.load.image('background1', 'background.png')
        this.load.image('potion', 'potion.png')
    //     this.load.image('player', 'player.png')

        //audio
        this.load.audio('ambient_one', 'soundtrack/ambient_song_one.mp3');
        this.load.audio('ambient_two', 'soundtrack/ambient_song_two.mp3');
        this.load.audio('battle', 'soundtrack/battle_song.mp3');
        this.load.audio('battle_start', 'soundtrack/soundeffect_battle_start.mp3');
        this.load.audio('main_menu', 'soundtrack/main_menu_song.mp3');
        this.load.audio('attack', 'soundtrack/soundeffect_attack.mp3');
        this.load.audio('enemy_death', 'soundtrack/soundeffect_enemy_death.mp3');
        this.load.audio('game_start', 'soundtrack/soundeffect_game_start.mp3');
        this.load.audio('heal', 'soundtrack/soundeffect_heal.mp3');
        this.load.audio('start_dialogue', 'soundtrack/soundeffect_start_dialogue.mp3');
        this.load.audio('combat_heal', 'soundtrack/soundeffect_combat_heal.mp3');
        this.load.audio('special_attack', 'soundtrack/soundeffect_special_attack.mp3');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu');
    }
}
