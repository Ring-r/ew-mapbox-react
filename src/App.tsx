import { LineLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import maplibregl from "maplibre-gl";
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useState } from "react";
import { Map } from "react-map-gl/maplibre";
import './App.css';

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

interface GeometryPoint {
    lat: number;
    lon: number;
}

interface Node {
    type: "node";
    id: number;
    lat: number;
    lon: number;
}

interface Way {
    type: "way";
    id: number;
    nodes: number[];
    tags: {
        highway?: string;
        [key: string]: string | undefined;
    };
    geometry: GeometryPoint[];
}

interface OverpassResponse {
    elements: (Node | Way)[];
}

const fetchRoadData = async (bbox: string): Promise<OverpassResponse> => {
    const query = `
    [out:json];
    way["highway"](${bbox});
    out geom;
  `;

    const response = await fetch(OVERPASS_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
        throw new Error("Failed to fetch data from Overpass API");
    }

    return response.json();
};

class CustomLineLayer extends LineLayer {
    getShaders() {
        return {
            ...super.getShaders(),
            //     vs: `#version 300 es
            //       in vec3 positions;
            //       out vec3 vPositions;

            //       void main() {
            //         vPositions = project_position(positions);
            //         gl_Position = vec4(vPositions, 0);
            //         gl_PointSize = 10.0;
            //       }
            //     `,
            //     fs: `#version 300 es
            //       in vec3 vPositions;
            //       out vec4 outColor;

            //       void main() {
            //         vec3 color = vec3(1.0, 0.0, 0.0);
            //         float lighting = 0.5 + 0.5 * sin(vPositions.x + vPositions.y);
            //         outColor = vec4(color * lighting, 1.0);
            //       }
            //     `,
            //   };
            // }
        }
    }
}

const App = () => {
    const [start, setStart] = useState({ lat: 49.982967, lon: 36.183048 });
    const [end, setEnd] = useState({ lat: 49.992669, lon: 36.231978 });
    const [bbox, setBbox] = useState<string>()
    const [roadList, setRoadList] = useState<(Node | Way)[]>([]);
    const [pathList, setPathList] = useState<number[][]>([]);

    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const minLat = Math.min(start.lat, end.lat);
        const maxLat = Math.max(start.lat, end.lat);
        const sizeLat = maxLat - minLat;

        const minLon = Math.min(start.lon, end.lon);
        const maxLon = Math.max(start.lon, end.lon);
        const sizeLon = maxLon - minLon;

        setBbox(`${minLat - 0.1 * sizeLat},${minLon - 0.1 * sizeLon},${maxLat + 0.1 * sizeLat},${maxLon + 0.1 * sizeLon}`)
    }, [start, end]);

    useEffect(() => {
        const getData = async () => {
            if (!bbox) return;
            try {
                const data = await fetchRoadData(bbox);
                setRoadList(data.elements);
            } catch (error) {
                console.error("Error fetching road data:", error);
            }
        };

        getData();
    }, [bbox]);

    useEffect(() => {
        const edges: number[][] = [];
        roadList.filter(d => d.type === "way").forEach(d => {
            if (d.type !== "way") return;

            for (let i = 0; i < d.geometry.length - 1; i++) {
                edges.push([
                    d.geometry[i].lon, d.geometry[i].lat,
                    d.geometry[i + 1].lon, d.geometry[i + 1].lat,
                ]);
            }
            setPathList(edges.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
        });
    }, [roadList]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev < pathList.length - 1 ? prev + 1 : prev));
        }, 10);
        return () => clearInterval(interval);
    }, [pathList]);

    const currentPath = pathList.slice(0, currentStep + 1);

    const layer = new CustomLineLayer({
        id: "road-layer",
        data: currentPath,
        getSourcePosition: p => [p[0], p[1]],
        getTargetPosition: p => [p[2], p[3]],
        getColor: [255, 255, 0, 100],
        getWidth: 5,
    });

    // const layer = new PathLayer({
    //   id: "path-layer",
    //   data: currentPath,
    //   getPath: (d: Way) => d.geometry.map(point => [point.lon, point.lat] as Position),
    //   getColor: [255, 0, 0],
    //   getWidth: 5,
    //   widthUnits: 'pixels',
    //   opacity: 0.8,
    //   rounded: true,
    // });

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [lat, lon] = e.target.value.split(",").map(Number);
        setStart({ lat, lon });
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [lat, lon] = e.target.value.split(",").map(Number);
        setEnd({ lat, lon });
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
            <form style={{ position: "absolute", zIndex: 1, padding: "10px", background: "white" }}>
                <input
                    type="text"
                    placeholder="Start (lat, lon)"
                    value={`${start.lat}, ${start.lon}`}
                    onChange={handleStartChange}
                />
                <input
                    type="text"
                    placeholder="End (lat, lon)"
                    value={`${end.lat}, ${end.lon}`}
                    onChange={handleEndChange}
                />
            </form>

            <DeckGL
                initialViewState={{
                    longitude: start.lon,
                    latitude: start.lat,
                    zoom: 13,
                }}
                controller={true}
                layers={[layer]}
            >

                <Map
                    mapLib={maplibregl}
                    mapStyle={MAP_STYLE}
                    style={{ width: "100%", height: "100%" }}
                />
            </DeckGL>
        </div>
    );

    // return (
    //   <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
    //     <Map
    //       initialViewState={{
    //         longitude: -122.4,
    //         latitude: 37.8,
    //         zoom: 14
    //       }}
    //       // mapStyle="https://demotiles.maplibre.org/style.json"
    //       mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    //     />
    //   </div>
    // );

};

export default App;
