import { useEffect, useRef, useState } from 'react';

export default function Gyroscope({ portal = false }: { portal?: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cleanup = () => {}, cancelled = false;
    void import('three').then(T => {
      if (cancelled || !mount.current) return;
      const host = mount.current;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
      catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setClearColor(0, 0);
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.z = portal ? 8.3 : 8;
      scene.add(new T.AmbientLight('#fff4dc', 2));
      const key = new T.DirectionalLight('#fff3d1', 3); key.position.set(3, 5, 6); scene.add(key);
      const fill = new T.DirectionalLight('#a8c9e6', 1.2); fill.position.set(-4, -1, 3); scene.add(fill);
      const root = new T.Group(); scene.add(root);
      // Non-PBR materials and steady lights avoid black metallic reflections on kiosk GPUs.
      const bronze = new T.MeshPhongMaterial({ color: '#b98050', specular: '#fff3c4', shininess: 80 });
      const gold = new T.MeshPhongMaterial({ color: '#efd0a1', specular: '#fff7df', shininess: 95 });
      const navy = new T.MeshPhongMaterial({ color: '#102d4c', specular: '#86b2d2', shininess: 65 });
      const rings: InstanceType<typeof T.Group>[] = [];
      for (let i = 0; i < 3; i++) {
        const group = new T.Group();
        const radius = 1.72 - i * 0.18;
        group.add(new T.Mesh(new T.TorusGeometry(radius, 0.045, 12, 128), bronze));
        group.add(new T.Mesh(new T.TorusGeometry(radius + 0.06, 0.012, 6, 128), gold));
        const ball = new T.Mesh(new T.SphereGeometry(0.14, 24, 16), navy); ball.position.x = radius; group.add(ball);
        root.add(group); rings.push(group);
      }
      let particles: InstanceType<typeof T.Points> | undefined;
      if (portal) {
        const positions = new Float32Array(1200 * 3);
        for (let i = 0; i < 1200; i++) {
          const theta = i * 2.39996, radius = 1.85 + (i % 47) / 20;
          positions[i * 3] = Math.cos(theta) * radius; positions[i * 3 + 1] = Math.sin(theta) * radius; positions[i * 3 + 2] = -((i % 100) / 12);
        }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
        particles = new T.Points(geometry, new T.PointsMaterial({ color: '#cba570', size: 0.018, transparent: true, opacity: 0.8 })); scene.add(particles);
      }
      host.appendChild(renderer.domElement);
      const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); };
      resize(); const observer = new ResizeObserver(resize); observer.observe(host);
      const start = performance.now();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let raf = 0;
      const animate = () => {
        const t = reduced ? 0.3 : (performance.now() - start) / 1000;
        rings[0].rotation.set(0.25 + Math.sin(t * 0.36) * 0.35, t * 0.24, 0.12);
        rings[1].rotation.set(1.05, t * -0.37, t * 0.16);
        rings[2].rotation.set(t * 0.3, 0.85, t * -0.21);
        root.rotation.z = Math.sin(t * 0.15) * 0.15;
        if (particles) particles.rotation.z = -t * 0.05;
        renderer.render(scene, camera); raf = requestAnimationFrame(animate);
      };
      const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); setFailed(true); };
      renderer.domElement.addEventListener('webglcontextlost', lost); animate();
      cleanup = () => {
        cancelAnimationFrame(raf); observer.disconnect(); renderer.domElement.removeEventListener('webglcontextlost', lost);
        scene.traverse(node => { if ('geometry' in node) (node.geometry as InstanceType<typeof T.BufferGeometry>).dispose(); });
        bronze.dispose(); gold.dispose(); navy.dispose();
        if (particles) (particles.material as InstanceType<typeof T.PointsMaterial>).dispose();
        renderer.dispose(); renderer.domElement.remove();
      };
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup(); };
  }, [portal]);
  return <div className={`gyroscope ${portal ? 'portal' : ''}`} ref={mount} aria-hidden="true">{failed && <div className="orbit-fallback"><i/><i/><i/></div>}</div>;
}
