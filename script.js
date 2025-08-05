const { MapboxOverlay, PolygonLayer, ScatterplotLayer, LineLayer } = deck;

async function loadGeoJSON(url) {
  const response = await fetch(url);
  return await response.json();
}

let currentMode = "spatial"; // "spatial" or "semantic"
let blocks, buildings, nodes, spatial_edges, semantic_edges;
let map, deckOverlay;
let layer_spacing = 1000;
let n_layers = 8;

const layerToggles = {
  showBlocks: true,
  showBuildings: true,
  showNodes: true,
  showEdges: true,
  invertLayers: false,
};

// Update elevation by user input slider for layer spacing
const get_elevation = (cluster) => {
  const baseline = 2000;
  if (layerToggles.invertLayers) {
    return cluster * layer_spacing + baseline;
  }
  return (n_layers - cluster) * layer_spacing + baseline;
};

const lightenColor = (color, amount = 0.5) => {
  // color: [r, g, b] or [r, g, b, a]
  return [
    Math.round(color[0] + (255 - color[0]) * amount),
    Math.round(color[1] + (255 - color[1]) * amount),
    Math.round(color[2] + (255 - color[2]) * amount),
    color.length > 3 ? color[3] : 255,
  ];
};

function buildingLayer(mode) {
  const color = `${mode}_color`;
  return new PolygonLayer({
    id: `buildings-${mode}`,
    data: [...buildings.features],
    getPolygon: (f) => {
      const coords = f.geometry.coordinates;
      if (f.geometry.type === "Polygon") return coords;
      if (f.geometry.type === "MultiPolygon") return coords[0];
      return [];
    },
    getFillColor: (f) => [...f.properties[color], 200], // add alpha
    extruded: true,
    getElevation: (f) => (f.properties.num_floors || 1) * 14,
    pickable: true,
    stroked: false,
  });
}

function blockLayer(mode) {
  const color = `${mode}_color`;
  return new PolygonLayer({
    id: "blocks",
    data: [...blocks.features],
    getPolygon: (f) => {
      const coords = f.geometry.coordinates;
      if (f.geometry.type === "Polygon") return coords;
      if (f.geometry.type === "MultiPolygon") return coords[0];
      return [];
    },
    getFillColor: (f) => f.properties[color],
    pickable: true,
    extruded: false,
    stroked: true,
    getLineColor: [0, 0, 0, 200],
    lineWidthMinPixels: 1,
  });
}

function nodeLayer(mode) {
  const color = `${mode}_color`;
  const cluster = `${mode}_cluster`;
  return new ScatterplotLayer({
    id: "nodes",
    data: [...nodes.features],
    getPosition: (f) => [
      f.geometry.coordinates[0],
      f.geometry.coordinates[1],
      get_elevation(f.properties[cluster]),
    ],
    getColor: (f) => f.properties[color],
    getRadius: 30,
    pickable: true,
  });
}

function edgeLayer(mode) {
  const color = `${mode}_color`;
  const cluster = `${mode}_cluster`;
  const edgesData =
    mode === "spatial" ? spatial_edges.features : semantic_edges.features;
  return new LineLayer({
    id: "edges",
    data: [...edgesData],
    getSourcePosition: (f) => [
      f.geometry.coordinates[0][0],
      f.geometry.coordinates[0][1],
      get_elevation(f.properties[cluster]),
    ],
    getTargetPosition: (f) => [
      f.geometry.coordinates[1][0],
      f.geometry.coordinates[1][1],
      get_elevation(f.properties[cluster]),
    ],
    getColor: (f) => lightenColor(f.properties[color], 0.2),
    getWidth: 0.5,
    pickable: true,
  });
}

function getLayers(mode) {
  const layers = [];
  if (layerToggles.showBlocks) layers.push(blockLayer(mode));
  if (layerToggles.showBuildings) layers.push(buildingLayer(mode));
  if (layerToggles.showNodes) layers.push(nodeLayer(mode));
  if (layerToggles.showEdges) layers.push(edgeLayer(mode));
  return layers;
}

// Checkbox event listeners
[
  "showBlocks",
  "showBuildings",
  "showNodes",
  "showEdges",
  "invertLayers",
].forEach((id) => {
  document.getElementById(id).addEventListener("change", (e) => {
    layerToggles[id] = e.target.checked;
    console.log(`${id} is now:`, layerToggles[id]);

    if (deckOverlay) {
      console.log("Updating layers with current mode:", currentMode);

      deckOverlay.setProps({ layers: getLayers(currentMode) });
    }
  });
});

//  event listeners
document.getElementById("spatialToggle").addEventListener("click", () => {
  currentMode = "spatial";
  document.getElementById("spatialToggle").classList.add("active");
  document.getElementById("semanticToggle").classList.remove("active");
  if (deckOverlay) deckOverlay.setProps({ layers: getLayers(currentMode) });
});
document.getElementById("semanticToggle").addEventListener("click", () => {
  currentMode = "semantic";
  document.getElementById("semanticToggle").classList.add("active");
  document.getElementById("spatialToggle").classList.remove("active");
  if (deckOverlay) deckOverlay.setProps({ layers: getLayers(currentMode) });
});
document.getElementById("layerSpacingSlider").addEventListener("input", (e) => {
  layer_spacing = Number(e.target.value);
  if (deckOverlay) deckOverlay.setProps({ layers: getLayers(currentMode) });
});

// Initialize the map and layers
async function initMap() {
  blocks = await loadGeoJSON("webmap-geodata/blocks.geojson");
  buildings = await loadGeoJSON("webmap-geodata/buildings.geojson");
  nodes = await loadGeoJSON("webmap-geodata/network_nodes.geojson");
  spatial_edges = await loadGeoJSON(
    "webmap-geodata/spatial_network_edges.geojson"
  );
  semantic_edges = await loadGeoJSON(
    "webmap-geodata/semantic_network_edges.geojson"
  );

  map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    center: [-73.97, 40.8],
    zoom: 11,
    pitch: 90,
    antialias: true,
  });

  map.on("style.load", () => {
    map.getStyle().layers.forEach((layer) => {
      if (
        layer.type === "symbol" ||
        (layer.layout && layer.layout["text-field"])
      ) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    });
    deckOverlay = new MapboxOverlay({
      layers: getLayers(currentMode),
    });
    map.addControl(deckOverlay);
  });
}

initMap();
