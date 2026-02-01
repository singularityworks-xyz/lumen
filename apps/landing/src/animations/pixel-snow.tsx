import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import fragmentShader from "./shaders/pixel-snow.frag?raw";
import vertexShader from "./shaders/pixel-snow.vert?raw";

interface PixelSnowProps {
  color?: string;
  flakeSize?: number;
  minFlakeSize?: number;
  pixelResolution?: number;
  speed?: number;
  depthFade?: number;
  farPlane?: number;
  brightness?: number;
  gamma?: number;
  density?: number;
  variant?: "square" | "round" | "snowflake";
  direction?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function PixelSnow({
  color = "#ffffff",
  flakeSize = 0.01,
  minFlakeSize = 1.25,
  pixelResolution = 200,
  speed = 1.25,
  depthFade = 8,
  farPlane = 20,
  brightness = 1,
  gamma = 0.4545,
  density = 0.3,
  variant = "square",
  direction = 125,
  className = "",
  style = {},
}: PixelSnowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const isVisibleRef = useRef(true);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);

  // Memoize shader variant value
  const variantValue = useMemo(
    () => (variant === "round" ? 1.0 : variant === "snowflake" ? 2.0 : 0.0),
    [variant]
  );

  // Memoize color conversion
  const colorVector = useMemo(() => {
    const threeColor = new Color(color);
    return new Vector3(threeColor.r, threeColor.g, threeColor.b);
  }, [color]);

  // Debounced resize handler
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = window.setTimeout(() => {
      const container = containerRef.current;
      const renderer = rendererRef.current;
      const material = materialRef.current;
      if (!(container && renderer && material)) {
        return;
      }

      const w = container.offsetWidth;
      const h = container.offsetHeight;
      renderer.setSize(w, h);
      material.uniforms.uResolution.value.set(w, h);
    }, 100);
  }, []);

  // Visibility observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main Three.js setup - only runs once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setClearColor(0x00_00_00, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Vector2(container.offsetWidth, container.offsetHeight),
        },
        uFlakeSize: { value: 0.01 },
        uMinFlakeSize: { value: 1.25 },
        uPixelResolution: { value: 200 },
        uSpeed: { value: 1.25 },
        uDepthFade: { value: 8 },
        uFarPlane: { value: 20 },
        uColor: { value: new Vector3(1, 1, 1) },
        uBrightness: { value: 1 },
        uGamma: { value: 0.4545 },
        uDensity: { value: 0.3 },
        uVariant: { value: 0 },
        uDirection: { value: (125 * Math.PI) / 180 },
      },
      transparent: true,
    });
    materialRef.current = material;

    const geometry = new PlaneGeometry(2, 2);
    scene.add(new Mesh(geometry, material));

    window.addEventListener("resize", handleResize);

    const startTime = performance.now();
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      // Only render if visible
      if (isVisibleRef.current) {
        material.uniforms.uTime.value = (performance.now() - startTime) * 0.001;
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      rendererRef.current = null;
      materialRef.current = null;
    };
  }, [handleResize]);

  // Update material uniforms when props change
  useEffect(() => {
    const material = materialRef.current;
    if (!material) {
      return;
    }

    material.uniforms.uFlakeSize.value = flakeSize;
    material.uniforms.uMinFlakeSize.value = minFlakeSize;
    material.uniforms.uPixelResolution.value = pixelResolution;
    material.uniforms.uSpeed.value = speed;
    material.uniforms.uDepthFade.value = depthFade;
    material.uniforms.uFarPlane.value = farPlane;
    material.uniforms.uBrightness.value = brightness;
    material.uniforms.uGamma.value = gamma;
    material.uniforms.uDensity.value = density;
    material.uniforms.uVariant.value = variantValue;
    material.uniforms.uDirection.value = (direction * Math.PI) / 180;
    material.uniforms.uColor.value.copy(colorVector);
  }, [
    flakeSize,
    minFlakeSize,
    pixelResolution,
    speed,
    depthFade,
    farPlane,
    brightness,
    gamma,
    density,
    variantValue,
    direction,
    colorVector,
  ]);

  return (
    <div
      className={`backface-hidden absolute inset-0 h-full w-full transform-gpu will-change-transform ${className}`}
      ref={containerRef}
      style={style}
    />
  );
}
