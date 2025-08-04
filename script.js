const { MapboxOverlay, PolygonLayer, ScatterplotLayer, LineLayer } = deck;

// Helper to load GeoJSON files
async function loadGeoJSON(url) {
  const response = await fetch(url);
  return await response.json();
}

async function initMap() {
  // Load data
  const blocks = await loadGeoJSON(
    "webmap-geodata/blocks_with_cluster.geojson"
  );
  const nodes = await loadGeoJSON("webmap-geodata/network_nodes.geojson");
  const edges = await loadGeoJSON(
    "webmap-geodata/spatial_network_edges.geojson"
  );

  // Create the maplibregl map
  const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [-73.97, 40.73],
    zoom: 11,
    pitch: 45,
    antialias: true,
  });

  const colors = [
    [44, 160, 44],
    [214, 39, 40],
    [31, 119, 180],
    [255, 127, 14],
    [148, 103, 189],
    [140, 86, 75],
    [227, 119, 194],
    [127, 127, 127],
  ];

  const get_elevation = (cluster) => {
    return (8 - cluster) * 800 + 1600;
  };

  map.on("style.load", () => {
    // Define deck.gl layers
    const blockLayer = new PolygonLayer({
      id: "blocks",
      data: blocks.features,
      getPolygon: (f) => {
        const coords = f.geometry.coordinates;
        if (f.geometry.type === "Polygon") return coords;
        if (f.geometry.type === "MultiPolygon") return coords[0];
        return [];
      },
      getFillColor: (f) => {
        return f.properties.spatial_color_rgb;
      },
      getElevation: (f) => 10,
      pickable: true,
      extruded: false,
      stroked: true,
      getLineColor: [0, 0, 0, 200],
      lineWidthMinPixels: 1,
    });

    const nodeLayer = new ScatterplotLayer({
      id: "nodes",
      data: nodes.features,
      getPosition: (f) => [
        f.geometry.coordinates[0],
        f.geometry.coordinates[1],
        get_elevation(f.properties.spatial_cluster),
      ],
      getColor: (f) => {
        return f.properties.spatial_color;
      },
      getRadius: 20,
      pickable: true,
      opacity: 0.6,
    });

    const edgeLayer = new LineLayer({
      id: "edges",
      data: edges.features,
      getSourcePosition: (f) => [
        f.geometry.coordinates[0][0],
        f.geometry.coordinates[0][1],
        get_elevation(f.properties.cluster),
      ],
      getTargetPosition: (f) => [
        f.geometry.coordinates[1][0],
        f.geometry.coordinates[1][1],
        get_elevation(f.properties.cluster),
      ],
      getColor: (f) => {
        return f.properties.spatial_color;
      },
      getWidth: 1,
      pickable: true,
    });

    // Add deck.gl overlay to the map
    const deckOverlay = new MapboxOverlay({
      layers: [blockLayer, nodeLayer, edgeLayer],
    });
    map.addControl(deckOverlay);
  });
}

initMap();
