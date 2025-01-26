import {GumloopClient} from 'gumloop'

export class WorldManager {
  static maps = {
      currentMap: '',
      leftMap: '',
      upMap: '',
      downMap: '',
      rightMap: '',
  };

  static loaded: boolean = false;

  static prompt: string = "test";
  static tileSet: string;
  static tileList: string[];

  static client: GumloopClient = new GumloopClient({
    apiKey: `${import.meta.env.VITE_TILESET_API_KEY}`,
    userId: `${import.meta.env.VITE_TILESET_USER_ID}`,
  });

  static getTiles = async () => await this.client.runFlow(`${import.meta.env.VITE_TILESET_FLOW_ID}`, {
    plot: this.prompt,
  });

  static async init(prompt: string) {
    this.prompt = prompt
    console.log(this.prompt);
    const res = await this.getTiles();
    this.tileSet = res.tileset
    this.tileList = res.tile_list.split(", ")

    this.maps.currentMap = await this.generateMap()
    this.loaded = true;
    Promise.all([
      this.generateMap(),
      this.generateMap(),
      this.generateMap(),
      this.generateMap(),
  ]).then(([downMap, upMap, leftMap, rightMap]) => {
      this.maps.downMap = downMap;
      this.maps.upMap = upMap;
      this.maps.leftMap = leftMap;
      this.maps.rightMap = rightMap;
  });
  }
  

  static generateMaps(nextPage: keyof typeof this.maps) {
      const nextMap = this.maps[nextPage];
      this.maps.currentMap = nextMap;

      // Assign adjacent maps dynamically
      Promise.resolve(this.generateMap()).then((map) => {
          this.maps[nextPage] = map;
      });
  }

  static async  generateMap(): Promise<string> {
    const out = await this.client.runFlow(`${import.meta.env.VITE_TILESET_FLOW_ID_2}`, {
    prompt: this.prompt,
    tileList: this.tileList.join(", "),
    image: this.tileSet,
  });

    return out.image
  }
}