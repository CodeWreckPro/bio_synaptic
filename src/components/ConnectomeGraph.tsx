import { useEffect, useRef } from 'react';
import type { Electrode } from '../hooks/useSynapticSim';
import { Share2 } from 'lucide-react';

interface ConnectomeGraphProps {
  electrodes: Electrode[];
}

type Edge = { a: number; b: number; strength: number };
type Position = { x: number; y: number };

function buildEdges(electrodes: Electrode[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < electrodes.length; i += 1) {
    for (let j = i + 1; j < electrodes.length; j += 1) {
      const averageRate = (electrodes[i].spikeRate + electrodes[j].spikeRate) / 2;
      if (averageRate === 0) continue;
      const strength = Math.max(0, 1 - Math.abs(electrodes[i].spikeRate - electrodes[j].spikeRate) / averageRate);
      if (strength > 0.75) edges.push({ a: i, b: j, strength });
    }
  }
  return edges;
}

function computeLayout(n: number, edges: Edge[], width: number, height: number): Position[] {
  const k = Math.sqrt((width * height) / n);
  const positions = Array.from({ length: n }, () => ({
    x: width / 2 + (Math.random() - 0.5) * width * 0.7,
    y: height / 2 + (Math.random() - 0.5) * height * 0.7,
  }));
  const velocity = Array.from({ length: n }, () => ({ x: 0, y: 0 }));

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const temperature = Math.max(2, 30 * (1 - iteration / 120));
    for (let i = 0; i < n; i += 1) {
      velocity[i] = { x: 0, y: 0 };
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const force = (k * k) / distance;
        velocity[i].x += (dx / distance) * force;
        velocity[i].y += (dy / distance) * force;
      }
    }
    for (const { a, b } of edges) {
      const dx = positions[a].x - positions[b].x;
      const dy = positions[a].y - positions[b].y;
      const distance = Math.max(0.01, Math.hypot(dx, dy));
      const force = (distance * distance) / k;
      velocity[a].x -= (dx / distance) * force;
      velocity[a].y -= (dy / distance) * force;
      velocity[b].x += (dx / distance) * force;
      velocity[b].y += (dy / distance) * force;
    }
    for (let i = 0; i < n; i += 1) {
      const magnitude = Math.max(0.01, Math.hypot(velocity[i].x, velocity[i].y));
      const scale = Math.min(magnitude, temperature) / magnitude;
      positions[i].x = Math.max(18, Math.min(width - 18, positions[i].x + velocity[i].x * scale));
      positions[i].y = Math.max(18, Math.min(height - 18, positions[i].y + velocity[i].y * scale));
    }
  }
  return positions;
}

function getNodeVisual(node: Electrode, now: number, birthTime?: number) {
  const newNodeProgress = birthTime === undefined ? 1 : Math.min(1, (now - birthTime) / 1800);
  if (node.state === 'apoptotic') {
    const pulse = 0.55 + 0.45 * Math.sin(now / 110);
    const fade = Math.max(0.12, node.health) * (0.55 + 0.45 * pulse);
    return { color: `rgba(255, 58, 86, ${fade})`, glow: `rgba(255, 58, 86, ${fade * 0.5})`, radius: 4 + pulse * 2, label: 'APOPTOTIC' };
  }
  if (node.state === 'stressed' || node.state === 'pruned') {
    const stress = Math.max(0.25, node.health);
    return { color: `rgba(255, 170, 42, ${stress})`, glow: `rgba(255, 125, 32, ${stress * 0.3})`, radius: 3.7, label: node.state.toUpperCase() };
  }
  const health = Math.max(0.45, node.health);
  const growthPulse = birthTime === undefined ? 0 : (1 - newNodeProgress) * (0.5 + 0.5 * Math.sin(now / 100));
  return { color: `rgba(0, 220, 255, ${health})`, glow: `rgba(0, 190, 255, ${0.32 + growthPulse * 0.35})`, radius: 3.8 + growthPulse * 2.8, label: growthPulse > 0.05 ? 'MITOSIS' : 'HEALTHY' };
}

export function ConnectomeGraph({ electrodes }: ConnectomeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<Position[]>([]);
  const previousIdsRef = useRef<Set<number> | null>(null);
  const birthsRef = useRef(new Map<number, number>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let frameId = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 420;
      canvas.height = rect.height || 300;
      layoutRef.current = [];
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const render = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx || electrodes.length === 0) {
        frameId = requestAnimationFrame(render);
        return;
      }
      const ids = new Set(electrodes.map(node => node.id));
      if (previousIdsRef.current) {
        electrodes.forEach(node => {
          if (!previousIdsRef.current?.has(node.id)) birthsRef.current.set(node.id, now);
        });
      }
      previousIdsRef.current = ids;
      birthsRef.current.forEach((_, id) => { if (!ids.has(id)) birthsRef.current.delete(id); });

      const edges = buildEdges(electrodes);
      if (layoutRef.current.length !== electrodes.length) {
        layoutRef.current = computeLayout(electrodes.length, edges, canvas.width, canvas.height);
      }
      const positions = layoutRef.current;
      ctx.fillStyle = 'rgba(2, 6, 12, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const { a, b, strength } of edges) {
        ctx.beginPath();
        ctx.moveTo(positions[a].x, positions[a].y);
        ctx.lineTo(positions[b].x, positions[b].y);
        ctx.strokeStyle = `rgba(0, 210, 255, ${((strength - 0.75) / 0.25) * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      electrodes.forEach((node, index) => {
        const position = positions[index];
        const visual = getNodeVisual(node, now, birthsRef.current.get(node.id));
        const firingBoost = node.voltage > 10 ? 1.6 : 1;
        const glow = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, visual.radius * 4 * firingBoost);
        glow.addColorStop(0, visual.glow);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(position.x, position.y, visual.radius * 4 * firingBoost, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(position.x, position.y, visual.radius * firingBoost, 0, Math.PI * 2);
        ctx.fillStyle = visual.color;
        ctx.fill();
      });
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      [['#00dcff', 'Healthy / young'], ['#ffaa2a', 'Stressed / pruned'], ['#ff3a56', 'Apoptotic']].forEach(([color, label], index) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(12, canvas.height - 40 + index * 13, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText(label, 22, canvas.height - 36 + index * 13);
      });
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(0,220,255,0.45)';
      ctx.fillText(`${edges.length} functional connections`, canvas.width - 8, canvas.height - 8);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); };
  }, [electrodes]);

  return <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Share2 size={18} style={{ color: 'var(--accent-cyan)' }} /><div><h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Functional Connectome</h3><p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>Live cell-state topology. New mitosis nodes pulse while they establish their place in the network.</p></div></div>
    <canvas ref={canvasRef} style={{ width: '100%', height: '300px', borderRadius: '10px', border: '1px solid rgba(0,240,255,0.08)', background: 'rgba(2,6,12,0.85)', display: 'block' }} />
  </div>;
}
