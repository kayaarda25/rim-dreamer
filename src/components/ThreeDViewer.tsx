import { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";

interface CarModelProps {
  url: string;
  rimColor?: string;
}

// Map rim color names to Three.js colors
const rimColorMap: Record<string, THREE.Color> = {
  black: new THREE.Color(0x1a1a1a),
  silver: new THREE.Color(0xc0c0c0),
  chrome: new THREE.Color(0xd4d4d4),
  bronze: new THREE.Color(0xcd7f32),
};

function CarModel({ url, rimColor }: CarModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);
  const wheelMeshes = useRef<THREE.Mesh[]>([]);

  // Fix materials and identify wheels
  useEffect(() => {
    // First pass: compute car bounding box for reference
    const carBox = new THREE.Box3().setFromObject(scene);
    const carCenter = carBox.getCenter(new THREE.Vector3());
    const carSize = carBox.getSize(new THREE.Vector3());
    const carBottomY = carBox.min.y;
    const carHeight = carSize.y;
    
    const wheels: { mesh: THREE.Mesh; score: number }[] = [];
    
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        // Improve all materials
        materials.forEach((mat) => {
          if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            const hsl = { h: 0, s: 0, l: 0 };
            stdMat.color.getHSL(hsl);
            if (hsl.l < 0.1) {
              stdMat.color.setHSL(hsl.h, hsl.s, 0.15);
            }
            stdMat.metalness = Math.max(stdMat.metalness, 0.5);
            stdMat.roughness = Math.min(stdMat.roughness, 0.4);
            stdMat.envMapIntensity = 2.5;
            stdMat.needsUpdate = true;
          }
        });

        // Strict wheel detection: must be LOW on the car and at the SIDES
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Wheel must be in the bottom 30% of the car
        const relativeY = (center.y - carBottomY) / carHeight;
        const isLow = relativeY < 0.3;
        
        // Wheel must be offset from center (at the sides of the car)
        const distFromCenterX = Math.abs(center.x - carCenter.x);
        const isAtSide = distFromCenterX > carSize.x * 0.15;
        
        // Wheel should not be at the very front or very back (headlights/taillights area)
        const relativeZ = (center.z - carBox.min.z) / carSize.z;
        const isNotExtremeFrontBack = relativeZ > 0.1 && relativeZ < 0.9;
        
        // Must have some minimum size
        const hasMinSize = size.x > carSize.x * 0.02;
        
        if (isLow && isAtSide && isNotExtremeFrontBack && hasMinSize) {
          // Score: prefer larger, lower, more side-positioned meshes
          const score = (1 - relativeY) * distFromCenterX * Math.max(size.x, size.y, size.z);
          wheels.push({ mesh, score });
        }
      }
    });
    
    // Sort by score and keep top 4
    wheels.sort((a, b) => b.score - a.score);
    wheelMeshes.current = wheels.slice(0, 4).map(w => w.mesh);
    console.log(`Detected ${wheelMeshes.current.length} wheel meshes (strict mode)`);
  }, [scene]);

  // Apply rim color to detected wheel meshes
  useEffect(() => {
    if (!rimColor || !rimColorMap[rimColor]) return;
    
    const color = rimColorMap[rimColor];
    wheelMeshes.current.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.color.copy(color);
          stdMat.metalness = 0.9;
          stdMat.roughness = 0.15;
          stdMat.envMapIntensity = 3.0;
          stdMat.needsUpdate = true;
        }
      });
    });
  }, [rimColor]);

  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3.5 / maxDim;

  // Store center Y for wheel detection
  (scene as any).__carCenterY = center.y;

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
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[6, 10, 64]} />
        <meshStandardMaterial color="#f2f2f2" roughness={1} metalness={0} transparent opacity={0.3} />
      </mesh>
    </>
  );
}

interface ThreeDViewerProps {
  modelUrl: string;
  rimColor?: string;
}

const ThreeDViewer = ({ modelUrl, rimColor }: ThreeDViewerProps) => {
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
      <div className="w-full rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center" style={{ minHeight: "600px" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">3D-Modell wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="w-full rounded-2xl overflow-hidden bg-muted/20 flex items-center justify-center" style={{ minHeight: "600px" }}>
        <p className="text-sm text-destructive">{error || "Modell konnte nicht geladen werden"}</p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center 60%, #ffffff 0%, #f0f0f0 40%, #e0e0e0 80%, #d5d5d5 100%)",
        minHeight: "600px",
        aspectRatio: "16/9",
      }}
    >
      <Canvas
        camera={{ position: [6, 1, 6], fov: 35 }}
        shadows
        dpr={[2, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 2.2,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Showroom-style lighting */}
        <ambientLight intensity={1.5} />
        {/* Key light - front-right, slightly above */}
        <directionalLight position={[4, 3, 4]} intensity={2.5} castShadow />
        {/* Fill from left */}
        <directionalLight position={[-4, 2, 2]} intensity={1.2} />
        {/* Back light for silhouette */}
        <directionalLight position={[0, 3, -5]} intensity={1.0} />
        {/* Front fill for face/grille */}
        <directionalLight position={[0, 1, 8]} intensity={0.8} />
        {/* Side accents */}
        <directionalLight position={[8, 1, 0]} intensity={0.6} />
        <directionalLight position={[-8, 1, 0]} intensity={0.6} />
        {/* Under-car subtle fill */}
        <pointLight position={[0, 0.3, 0]} intensity={0.5} />

        <Suspense fallback={<LoadingFallback />}>
          <CarModel url={blobUrl} rimColor={rimColor} />
          <GroundPlane />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.15}
            scale={12}
            blur={2}
          />
          <Environment preset="studio" background={false} />
        </Suspense>

        {/* Eye-level camera with only horizontal rotation */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={4}
          maxDistance={12}
          minPolarAngle={Math.PI / 2.4}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0.7, 0]}
        />
      </Canvas>
    </div>
  );
};

export default ThreeDViewer;
