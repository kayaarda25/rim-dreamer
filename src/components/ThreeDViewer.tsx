import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";

interface CarModelProps {
  url: string;
}

function CarModel({ url }: CarModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  // Fix dark materials - brighten everything
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.isMeshStandardMaterial) {
          // Brighten dark materials
          const hsl = { h: 0, s: 0, l: 0 };
          mat.color.getHSL(hsl);
          if (hsl.l < 0.15) {
            mat.color.setHSL(hsl.h, hsl.s, Math.max(hsl.l, 0.25));
          }
          // Increase metalness/roughness for better reflections
          mat.metalness = Math.max(mat.metalness, 0.3);
          mat.roughness = Math.min(mat.roughness, 0.7);
          mat.envMapIntensity = 1.5;
          mat.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2.5 / maxDim;

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

function GroundPlane() {
  return (
    <>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[4, 64]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Outer ring for depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[4, 6, 64]} />
        <meshStandardMaterial color="#f0f0f0" roughness={1} metalness={0} transparent opacity={0.5} />
      </mesh>
    </>
  );
}

// Auto-rotate component
function AutoRotate() {
  const { camera } = useThree();
  const angle = useRef(0);
  
  useFrame((_, delta) => {
    angle.current += delta * 0.15;
    const radius = camera.position.length();
    const height = camera.position.y;
    camera.position.x = Math.sin(angle.current) * radius * Math.cos(Math.atan2(height, radius));
    camera.position.z = Math.cos(angle.current) * radius * Math.cos(Math.atan2(height, radius));
    camera.lookAt(0, 0.5, 0);
  });
  
  return null;
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
    <div
      className="w-full aspect-video rounded-2xl overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #ffffff 0%, #e8e8e8 60%, #d0d0d0 100%)" }}
    >
      <Canvas
        camera={{ position: [4, 2, 4], fov: 35 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.8,
        }}
      >
        {/* Strong ambient for overall brightness */}
        <ambientLight intensity={1.0} />
        {/* Key light */}
        <directionalLight position={[5, 8, 3]} intensity={2.0} castShadow />
        {/* Fill lights */}
        <directionalLight position={[-4, 5, -2]} intensity={0.8} />
        <directionalLight position={[0, 3, -5]} intensity={0.5} />
        {/* Rim light from behind */}
        <directionalLight position={[-2, 4, 5]} intensity={0.6} />
        {/* Bottom fill to reduce dark underside */}
        <pointLight position={[0, -1, 0]} intensity={0.3} />

        <Suspense fallback={<LoadingFallback />}>
          <CarModel url={blobUrl} />
          <GroundPlane />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.25}
            scale={8}
            blur={2.5}
          />
          <Environment preset="studio" background={false} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={8}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 2.8}
          minAzimuthAngle={-Infinity}
          maxAzimuthAngle={Infinity}
          target={[0, 0.5, 0]}
        />
      </Canvas>
    </div>
  );
};

export default ThreeDViewer;
