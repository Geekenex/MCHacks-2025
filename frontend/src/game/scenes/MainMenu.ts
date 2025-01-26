import { GameObjects, Scene } from 'phaser';
import { SpriteManager } from '../scripts/SpriteManager';
import { EventBus } from '../EventBus';
import { WorldManager } from '../scripts/WorldManager';

//env vars
import.meta.env.VITE_API_KEY;
import.meta.env.VITE_USER_ID;
import.meta.env.VITE_FLOW_ID;

export class MainMenu extends Scene
{



    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;
    backgroundMusic: Phaser.Sound.BaseSound;

    constructor ()
    {
        super('MainMenu');
    }

    async create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.backgroundMusic = this.sound.add('main_menu', { loop: true });
        this.backgroundMusic.play();

        this.logo = this.add.image(512, 300, 'logo').setDepth(100);


        //input n button
        const inputElement = this.add.dom(512, 400).createFromCache('initialPromptInput');

        // Add event listener to the button
        inputElement.addListener('click');
        inputElement.on('click', async (event: any) => {
            if (event.target.id === 'start-button') {
                
                const input = (document.getElementById('prompt-input') as HTMLInputElement).value;

                if (input) {
                    console.log('User Input:', input);
                    // this.sendToAPI(input);
                    //start game scene w prompt
                    await SpriteManager.generateSprite(input);

                    const playerSprite = SpriteManager.getSprite();
                    if (playerSprite) {
                        //this.textures.addBase64('player', playerSprite);
                        console.log('Player sprite loaded and added to textures.');
                    } else {
                        alert('Failed to load the sprite. Please try again.');
                        return;
                    }
                    await Promise.all([
                        WorldManager.init(input),
                    ]);
                    
                    this.background = this.add.image(512, 384, this.textures.get(WorldManager.maps.currentMap));

                    this.changeScene(input);
                } else {
                    alert('Please enter a prompt before starting the game.');
                }
            }
        });


        EventBus.emit('current-scene-ready', this);
    }
    
    changeScene (input: String)
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start('Game', { input });
        this.backgroundMusic.stop();
        this.sound.add('game_start').play();
    }

    moveLogo (vueCallback: ({ x, y }: { x: number, y: number }) => void)
    {
        if (this.logoTween)
        {
            if (this.logoTween.isPlaying())
            {
                this.logoTween.pause();
            }
            else
            {
                this.logoTween.play();
            }
        } 
        else
        {
            this.logoTween = this.tweens.add({
                targets: this.logo,
                x: { value: 750, duration: 3000, ease: 'Back.easeInOut' },
                y: { value: 80, duration: 1500, ease: 'Sine.easeOut' },
                yoyo: true,
                repeat: -1,
                onUpdate: () => {
                    if (vueCallback)
                    {
                        vueCallback({
                            x: Math.floor(this.logo.x),
                            y: Math.floor(this.logo.y)
                        });
                    }
                }
            });
        }
    }
}
