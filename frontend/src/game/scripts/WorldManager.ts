export class WorldManager {
  static maps = {
      currentMap: 'background1',
      leftMap: 'background1',
      upMap: 'background1',
      downMap: 'background1',
      rightMap: 'background1',
  };

  static generateMaps(nextPage: keyof typeof WorldManager.maps) {
      const nextMap = this.maps[nextPage];
      this.maps.currentMap = nextMap;

      // Assign adjacent maps dynamically
      this.maps.leftMap = 'background1';
      this.maps.rightMap = 'background1';
      this.maps.upMap = 'background1';
      this.maps.downMap = 'background1';
  }
}