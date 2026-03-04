import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";

interface CarModelProps {
  url: string;
}

function CarModel({ url }: CarModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2 / maxDim;

  // Place car on ground: shift so bottom of bounding box is at y=0
  const bottomY = box.min.y;
  scene.position.set(
    -center.x * scale,
    (-bottomY) * scale,
    -center.z * scale
  );
  scene.scale.setScalar(scale);

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

function LoadingFallback() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="hsl(43, 96%, 56%)" wireframe />
    </mesh>
  );
}

// Ground plane with subtle grid/circle like Mercedes configurator
function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[3, 64]} />
      <meshStandardMaterial
        color="#f5f5f5"
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

interface ThreeDViewerProps {
  modelUrl: string;
}

const ThreeDViewer = ({ modelUrl }: ThreeDViewerProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchModel = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const resp = await fetch(`${supabaseUrl}/functions/v1/proxy-model`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ url: modelUrl }),
        });

        if (!resp.ok) throw new Error(`Proxy failed: ${resp.status}`);

        const blob = await resp.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load model");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchModel();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [modelUrl]);

  if (loading) {
    return (
      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">3D-Modell wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center">
        <p className="text-sm text-destructive">{error || "Modell konnte nicht geladen werden"}</p>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden" style={{ background: "linear-gradient(180deg, #e8e8e8 0%, #f8f8f8 40%, #ffffff 100%)" }}>
      <Canvas
        camera={{ position: [4, 1.5, 4], fov: 40 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-3, 4, -3]} intensity={0.3} />

        <Suspense fallback={<LoadingFallback />}>
          <CarModel url={blobUrl} />
          <GroundPlane />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.3}
            scale={6}
            blur={2}
          />
          <Environment preset="studio" />
        </Suspense>

        {/* Horizontal-only rotation, fixed height, like Mercedes configurator */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={8}
          // Lock vertical angle to a slight top-down view
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 3}
          // Allow full 360° horizontal rotation
          minAzimuthAngle={-Infinity}
          maxAzimuthAngle={Infinity}
          target={[0, 0.5, 0]}
        />
      </Canvas>
    </div>
  );
};

export default ThreeDViewer;
