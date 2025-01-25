import { GameObjects, Scene } from 'phaser';

import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{


    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.logo = this.add.image(512, 300, 'logo').setDepth(100);

        // this.title = this.add.text(512, 460, 'Main Menu', {
        //     fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
        //     stroke: '#000000', strokeThickness: 8,
        //     align: 'center'
        // }).setOrigin(0.5).setDepth(100);

        //input n button
        const inputElement = this.add.dom(512, 400).createFromCache('initialPromptInput');

        // Add event listener to the button
        inputElement.addListener('click');
        inputElement.on('click', (event: any) => {
            if (event.target.id === 'start-button') {
                
                const input = (document.getElementById('prompt-input') as HTMLInputElement).value;

                if (input) {
                    console.log('User Input:', input);
                    this.sendToAPI(input);
                } else {
                    alert('Please enter a prompt before starting the game.');
                }
            }
        });

        EventBus.emit('current-scene-ready', this);
    }
    sendToAPI(input: string) {
        fetch('https://example.com/api', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: input }),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('API Response:', data);
                this.scene.start('Game');
            })
            .catch((error) => {
                console.error('Error sending to API:', error);
            });
    }

    
    changeScene ()
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start('Game');
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
