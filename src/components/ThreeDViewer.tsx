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

  // Fix materials for better rendering
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            // Brighten very dark materials
            const hsl = { h: 0, s: 0, l: 0 };
            stdMat.color.getHSL(hsl);
            if (hsl.l < 0.1) {
              stdMat.color.setHSL(hsl.h, hsl.s, 0.2);
            }
            // Better car-like reflections
            stdMat.metalness = Math.max(stdMat.metalness, 0.4);
            stdMat.roughness = Math.min(stdMat.roughness, 0.5);
            stdMat.envMapIntensity = 2.0;
            stdMat.needsUpdate = true;
          }
        });
      }
    });
  }, [scene]);

  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3 / maxDim;

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[5, 64]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[5, 8, 64]} />
        <meshStandardMaterial color="#f2f2f2" roughness={1} metalness={0} transparent opacity={0.4} />
      </mesh>
    </>
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
      <div className="w-full rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center" style={{ minHeight: "560px" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">3D-Modell wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="w-full rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center" style={{ minHeight: "560px" }}>
        <p className="text-sm text-destructive">{error || "Modell konnte nicht geladen werden"}</p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center bottom, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)",
        minHeight: "560px",
        aspectRatio: "16/9",
      }}
    >
      <Canvas
        camera={{ position: [5, 1.2, 5], fov: 40 }}
        shadows
        dpr={[2, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 2.0,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Bright, even lighting */}
        <ambientLight intensity={1.2} />
        {/* Main key light - slightly above eye level */}
        <directionalLight position={[5, 4, 3]} intensity={2.5} castShadow />
        {/* Fill from left */}
        <directionalLight position={[-5, 3, 2]} intensity={1.0} />
        {/* Back light */}
        <directionalLight position={[0, 3, -5]} intensity={0.8} />
        {/* Front fill */}
        <directionalLight position={[0, 2, 6]} intensity={0.6} />
        {/* Under-car fill */}
        <pointLight position={[0, 0.2, 0]} intensity={0.4} />

        <Suspense fallback={<LoadingFallback />}>
          <CarModel url={blobUrl} />
          <GroundPlane />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.2}
            scale={10}
            blur={2}
          />
          <Environment preset="studio" background={false} />
        </Suspense>

        {/* Eye-level camera, only horizontal rotation */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={4}
          maxDistance={10}
          minPolarAngle={Math.PI / 2.3}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0.6, 0]}
        />
      </Canvas>
    </div>
  );
};

export default ThreeDViewer;
