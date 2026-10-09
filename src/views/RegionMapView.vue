<script>
import {useGameStore} from '../stores/game'
import {Deck, OrthographicView, COORDINATE_SYSTEM} from '@deck.gl/core';
import {BitmapLayer, GeoJsonLayer, IconLayer} from '@deck.gl/layers';
import {TileLayer} from '@deck.gl/geo-layers';
import { markRaw } from 'vue'
import { mapLifecycle } from '../mapLifecycle.js'
import { fetchJson } from '../dataLoading.mjs'
import { resourceUrl } from '../resourceUrls.mjs'

export default {
  mixins: [mapLifecycle],
  setup() {
    const gameStore = useGameStore()
    return { gameStore }
  },

  components: {
    
  },

  data() {
    return {
      deck: null,
      tileLayer: null,
      rgLayer: null,
      rLayer: null,
      resourceLayer: null,
      originLayer: null,
      initialViewState: {
        target: [0, 0],
        zoom: -12,
        minZoom: -12,
        maxZoom: -5,
        //transitionDuration: 1000,
        //transitionInterpolator: new MyInterpolator(1000)
      },
      hoverx: 0,
      hovery: 0,
      selectedZone: 0,
      highlightedIcon: 0,
      currentLayer: 'RG',
    }
  },

  computed: {

  },

  mounted() {
    this._regionData = new Map()
    this.deck = markRaw(this.initializeDeck())
  },

  watch: {
    highlightedIcon(newVal) {
      this.updateRegionLayers()
    },
    currentLayer(newVal) {
      this.highlightedIcon = 0
      this.updateRegionLayers()
    },
  },

  methods: {
    regionData(key, url) {
      if (!this._regionData.has(key)) {
        this._regionData.set(key, fetchJson(url, { signal: this._mapController.signal }).catch(error => {
          if (error.name === 'AbortError') return []
          this._regionData.delete(key)
          throw error
        }))
      }
      return this._regionData.get(key)
    },
    currentRegionLayers() {
      if (this.currentLayer === 'RG') {
        this.rgLayer = markRaw(this.makeRgLayer())
        this.resourceLayer = markRaw(this.makeResourceLayer())
        return [this.tileLayer, this.rgLayer, this.resourceLayer]
      }
      this.rLayer = markRaw(this.makeRLayer())
      this.originLayer = markRaw(this.makeOriginLayer())
      return [this.tileLayer, this.rLayer, this.originLayer]
    },
    updateRegionLayers() {
      this.deck?.setProps({ layers: this.currentRegionLayers() })
    },
    makeResourceLayer() {
      return new IconLayer({
        id: 'ResourceLayer',
        data: this.regionData('resources', 'data/deck_rg_graphs.json'),
        getPosition: d => [d.graphx, d.graphz],
        getColor: d => [66, 66, 66, 255],  // r, g, b have no effect, only alpha does
        getIcon: function(d) {
          return {
            url: resourceUrl('data/icons/target_percent.png'),
            width: 128,
            height: 128,
            anchorX: 64,
            anchorY: 64,
          }
        },
        modelMatrix: [
          1, 0, 0, 0,
          0, -1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ],
        getSize: d => d.k == this.highlightedIcon ? 50 : 0,
        //autoHighlight: true,
        //pickable: true,
        visible: this.currentLayer == 'RG',
        updateTriggers: {
          getSize: this.highlightedIcon, // accessor does not re-run by default
        }
      })
    },
    makeOriginLayer() {
      return new IconLayer({
        id: 'OriginLayer',
        data: this.regionData('origins', 'data/deck_r_origins.json'),
        getPosition: d => [d.x, d.z],
        getColor: d => [66, 66, 66, 255],  // r, g, b have no effect, only alpha does
        getIcon: function(d) {
          return {
            url: resourceUrl('data/icons/target_orig.png'),
            width: 128,
            height: 128,
            anchorX: 64,
            anchorY: 64,
          }
        },
        modelMatrix: [
          1, 0, 0, 0,
          0, -1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ],
        getSize: d => d.r == this.highlightedIcon ? 50 : 0,
        //autoHighlight: true,
        //pickable: true,
        visible: this.currentLayer == 'R',
        updateTriggers: {
          getSize: this.highlightedIcon, // accessor does not re-run by default
        }
      })
    },

    makeRgLayer() {
      return new GeoJsonLayer({
        id: 'RegionGroupLayer',
        data: this.regionData('RG', 'data/rg_latest.geojson'),

        stroked: false,  // default: true
        getLineWidth: 50,  
        //lineWidthUnits: 'pixels',  // default: meters
        lineWidthMinPixels: 1,
        getLineColor: [255, 255, 255],
        //filled: false,
        getFillColor: f => f.properties.c,
        //pointType: 'circle+text',
        pickable: true,
        //getPointRadius: 4,
        //getText: f => f.properties.c,
        //getTextSize: 12,

        /* props inherited from Layer class */

        autoHighlight: true,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        //highlightColor: [0, 0, 128, 128],
        modelMatrix: [
          301.1765,        0, 0, 0,
                 0, 301.1765, 0, 0,
                 0,        0, 1, 0,
          -2048000, -2048000, 0, 1
        ],
        opacity: 0.1,
        visible: this.currentLayer == 'RG',
        // wrapLongitude: false,

        onHover: ({object}) => {
          if (object && object.properties) {
            this.highlightedIcon = object.properties.rg
          }
        },
      })
    },
    
    makeRLayer() {
      return new GeoJsonLayer({
        id: 'RegionLayer',
        data: this.regionData('R', 'data/r_latest.geojson'),

        stroked: false,  // default: true
        getLineWidth: 50,  
        //lineWidthUnits: 'pixels',  // default: meters
        lineWidthMinPixels: 1,
        getLineColor: [255, 255, 255],
        //filled: false,
        getFillColor: f => f.properties.c,
        //pointType: 'circle+text',
        pickable: true,
        //getPointRadius: 4,
        //getText: f => f.properties.c,
        //getTextSize: 12,

        /* props inherited from Layer class */

        autoHighlight: true,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        //highlightColor: [0, 0, 128, 128],
        modelMatrix: [
          301.1765,        0, 0, 0,
                 0, 301.1765, 0, 0,
                 0,        0, 1, 0,
          -2048000, -2048000, 0, 1
        ],
        opacity: 0.1,
        visible: this.currentLayer == 'R',
        // wrapLongitude: false,

        onHover: ({object}) => {
          if (object && object.properties) {
            this.highlightedIcon = object.properties.r
          }
        },
      })
    },

    initializeDeck() {
      this.tileLayer = markRaw(new TileLayer({
        id: 'TileLayer',
        data: resourceUrl('data/maptiles/{z}/{x}_{y}.webp'),
        minZoom: 0,
        maxZoom: this.mapTileMaxZoom,
        tileSize: 256 * 12800,
        zoomOffset: 14,
        extent: [
          (-67 * 2) * 12800,
          (-71 * 2) * 12800,
          (58 * 2) * 12800,
          (35 * 2) * 12800
        ],
        renderSubLayers: props => {
          const {
            bbox: {left, bottom, right, top}
          } = props.tile;

          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [left, bottom, right, top]
          });
        }
      }))

      const deckInstance = new Deck({
        canvas: 'deck-canvas',
        mapbox: false,

        initialViewState: this.initialViewState,

        layers: this.currentRegionLayers(),

        controller: {doubleClickZoom: false},
        getTooltip: ({object}) => {
          if (object && object.properties) {
            if (object.properties.r) {
              return `R${object.properties.r} ${this.gameStore.uloc.town[object.properties.r]}`
            }
            if (object.properties.rg) {
              let ret = `RG${object.properties.rg}`
              //const member_indices = object.properties.rs
              //for (const ri of member_indices) {
              //  ret += `\n${this.gameStore.uloc.town[ri]}`
              //}
              return ret
            }
          }
        },

        views: [
          new OrthographicView({
            controller: true,
          }),
        ],

        onHover: (info, event) => {
          if (info.coordinate) {
            //console.log(info.coordinate)
            this.hoverx = Math.round(info.coordinate[0])
            this.hovery = Math.round(info.coordinate[1])
          }
        },

        /*onClick: ({x, y}) => {
          const pickInfo = deckInstance.pickObject({x, y});
          console.log(pickInfo);
        },*/
      });

      return deckInstance
    },
  }
}
</script>

<template>
  
  <main>
    <div id="canvas-limiter">
      <canvas id="deck-canvas" ref="canvas"></canvas>
      
      <div id="coords">
        x: {{ hoverx }} y: {{ -hovery }}
        <div>
          <input type="radio" id="sr" value="R" v-model="currentLayer" />
          <label for="sr">Regions</label>
          <input type="radio" id="srg" value="RG" v-model="currentLayer" />
          <label for="srg">RegionGroups</label>
        </div>
      </div>
      
    </div>
</main>

</template>

<style scoped>
main {
  display: flex;
  flex-direction: column;
  height: 98%;
  overflow: hidden;
}
#canvas-limiter {
  height: 100%;
  width: 100%;
}
#deck-canvas {
  height: 50%;
}
#coords {
  position: absolute;
  bottom: 0;
}
#topright {
  float: right;
}
label {
  margin: 3px;
}
</style>
