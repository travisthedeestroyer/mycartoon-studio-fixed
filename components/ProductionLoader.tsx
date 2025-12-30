
import React, { useState, useEffect, useRef } from 'react';
import { GenerationProgress, Theme } from '../types';
import { 
  Clapperboard, Paintbrush, Mic2, Film, Star, Cloud, Sparkles, Target, Crosshair, 
  Gem, Skull, Crown, XCircle 
} from 'lucide-react';

interface ProductionLoaderProps {
  progress: GenerationProgress;
  theme: Theme;
  onCollectCoin: (amount: number) => void;
  userAge: number;
  onCancel?: () => void;
}

// -- SHOOTER TYPES --
interface PlayerShip {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
}

interface GeoEnemy {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: 'grunt' | 'speeder' | 'heavy';
    hp: number;
    color: string;
    score: number;
    angle: number;
}

interface Bullet {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

export const ProductionLoader: React.FC<ProductionLoaderProps> = ({ progress, theme, onCollectCoin, userAge, onCancel }) => {
  // Game Logic State
  const [sessionScore, setSessionScore] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // -- YOUNGER KIDS GAME (Bubbles / Targets) State --
  const [simpleItems, setSimpleItems] = useState<any[]>([]);
  
  // -- OLDER KIDS GAME (Geometry Shooter) Refs --
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs
  const playerRef = useRef<PlayerShip>({ x: 0, y: 0, vx: 0, vy: 0, angle: 0 });
  
  // Input Refs
  const targetPosRef = useRef<{ x: number, y: number } | null>(null); // For movement (Mouse/Touch1)
  const shootInputRef = useRef<{ x: number, y: number, active: boolean }>({ x: 0, y: 0, active: false }); // For shooting (Arrows/Touch2)
  const arrowKeysRef = useRef<{ up: boolean, down: boolean, left: boolean, right: boolean }>({ 
      up: false, down: false, left: false, right: false 
  });
  
  const enemiesRef = useRef<GeoEnemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef(0);
  const shootCooldownRef = useRef(0);
  
  // Determine Mode
  const isShooter = userAge >= 10;
  const isTargetPractice = userAge >= 8 && userAge < 10;
  
  const COLORS = ['text-red-400', 'text-yellow-400', 'text-blue-400', 'text-green-400', 'text-purple-400'];

  const getIcon = () => {
    switch (progress.status) {
      case 'scripting': return <Clapperboard className="w-16 h-16 text-yellow-400 animate-bounce" />;
      case 'visuals': return <Paintbrush className="w-16 h-16 text-pink-400 animate-pulse" />;
      case 'audio': return <Mic2 className="w-16 h-16 text-blue-400 animate-pulse" />;
      default: return <Film className="w-16 h-16 text-green-400" />;
    }
  };

  const getPercent = () => {
     if (progress.status === 'scripting') return 10;
     const base = 20;
     const perScene = 80 / (progress.totalScenes || 1);
     const current = progress.currentScene * perScene;
     return Math.min(100, base + current);
  };

  const handleInteraction = () => {
      if (!hasInteracted) setHasInteracted(true);
  };

  // ----------------------------------------------------------------
  // GEOMETRY SHOOTER LOGIC (Age 10+)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!isShooter) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initial Setup
    playerRef.current = { x: container.clientWidth / 2, y: container.clientHeight / 2, vx: 0, vy: 0, angle: 0 };
    targetPosRef.current = { x: container.clientWidth / 2, y: container.clientHeight / 2 };

    // Resize Handler
    const resize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => { 
        handleInteraction();
        if (e.code === 'ArrowUp') arrowKeysRef.current.up = true;
        if (e.code === 'ArrowDown') arrowKeysRef.current.down = true;
        if (e.code === 'ArrowLeft') arrowKeysRef.current.left = true;
        if (e.code === 'ArrowRight') arrowKeysRef.current.right = true;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => { 
        if (e.code === 'ArrowUp') arrowKeysRef.current.up = false;
        if (e.code === 'ArrowDown') arrowKeysRef.current.down = false;
        if (e.code === 'ArrowLeft') arrowKeysRef.current.left = false;
        if (e.code === 'ArrowRight') arrowKeysRef.current.right = false;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        targetPosRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    // Touch Handling (Move and Shoot)
    const handleTouch = (e: TouchEvent) => {
        e.preventDefault();
        handleInteraction();
        const rect = canvas.getBoundingClientRect();
        
        // Reset inputs
        let moveTouch = null;
        let shootTouch = null;
        
        // Heuristic: First touch is Move, Second touch is Shoot
        if (e.touches.length > 0) {
            moveTouch = e.touches[0];
            if (e.touches.length > 1) {
                shootTouch = e.touches[1];
            }
        }

        if (moveTouch) {
            targetPosRef.current = {
                x: moveTouch.clientX - rect.left,
                y: moveTouch.clientY - rect.top
            };
        }
        
        if (shootTouch) {
            const tx = shootTouch.clientX - rect.left;
            const ty = shootTouch.clientY - rect.top;
            shootInputRef.current = {
                x: tx,
                y: ty,
                active: true
            };
        } else {
            shootInputRef.current.active = false;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouch);

    // Physics Constants
    const ACCEL = 0.8;
    const FRICTION = 0.94;
    const MAX_SPEED = 8;
    const BULLET_SPEED = 15;

    // Helper: Spawn Particles
    const spawnParticles = (x: number, y: number, color: string, count: number) => {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            particlesRef.current.push({
                id: Math.random(),
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color
            });
        }
    };

    const gameLoop = () => {
        // Clear
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw Grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for (let y = 0; y < canvas.height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.stroke();

        frameCountRef.current++;

        // --- UPDATE PLAYER (Move towards Mouse/Touch) ---
        const p = playerRef.current;
        const target = targetPosRef.current;
        
        if (target) {
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Accelerate towards target
            if (dist > 10) {
                const ax = (dx / dist) * ACCEL;
                const ay = (dy / dist) * ACCEL;
                p.vx += ax;
                p.vy += ay;
            } else {
                // Dampen when close
                p.vx *= 0.8;
                p.vy *= 0.8;
            }
            
            // Face target
            p.angle = Math.atan2(dy, dx);
        }

        // Apply Friction
        p.vx *= FRICTION;
        p.vy *= FRICTION;

        // Cap Speed
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        if (speed > MAX_SPEED) {
            p.vx = (p.vx / speed) * MAX_SPEED;
            p.vy = (p.vy / speed) * MAX_SPEED;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Boundaries (Bounce)
        const PAD = 20;
        if (p.x < PAD) { p.x = PAD; p.vx *= -0.6; }
        if (p.x > canvas.width - PAD) { p.x = canvas.width - PAD; p.vx *= -0.6; }
        if (p.y < PAD) { p.y = PAD; p.vy *= -0.6; }
        if (p.y > canvas.height - PAD) { p.y = canvas.height - PAD; p.vy *= -0.6; }

        // --- SHOOTING LOGIC ---
        if (shootCooldownRef.current > 0) shootCooldownRef.current--;
        
        let shootVector = { x: 0, y: 0 };
        let shooting = false;

        // 1. Arrow Keys (Desktop)
        if (arrowKeysRef.current.left) shootVector.x -= 1;
        if (arrowKeysRef.current.right) shootVector.x += 1;
        if (arrowKeysRef.current.up) shootVector.y -= 1;
        if (arrowKeysRef.current.down) shootVector.y += 1;
        
        if (shootVector.x !== 0 || shootVector.y !== 0) {
            shooting = true;
        } 
        // 2. Touch (Mobile)
        else if (shootInputRef.current.active) {
            const dx = shootInputRef.current.x - p.x;
            const dy = shootInputRef.current.y - p.y;
            shootVector = { x: dx, y: dy };
            shooting = true;
        }

        if (shooting && shootCooldownRef.current <= 0) {
            const angle = Math.atan2(shootVector.y, shootVector.x);
            
            bulletsRef.current.push({
                id: Math.random(),
                x: p.x + Math.cos(angle) * 20,
                y: p.y + Math.sin(angle) * 20,
                vx: Math.cos(angle) * BULLET_SPEED,
                vy: Math.sin(angle) * BULLET_SPEED,
                life: 60
            });
            
            shootCooldownRef.current = 6; // Fire Rate
            
            // Recoil
            p.vx -= Math.cos(angle) * 1.5;
            p.vy -= Math.sin(angle) * 1.5;
            
            // FX
            spawnParticles(p.x + Math.cos(angle)*20, p.y + Math.sin(angle)*20, '#fbbf24', 2);
        }

        // --- UPDATE BULLETS ---
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbbf24';
        ctx.fillStyle = '#fbbf24';
        for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
            const b = bulletsRef.current[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;

            if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                bulletsRef.current.splice(i, 1);
                continue;
            }

            // Draw Bullet
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- SPAWN ENEMIES ---
        if (frameCountRef.current % 40 === 0) {
            const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
            let ex = 0, ey = 0;
            if (side === 0) { ex = Math.random() * canvas.width; ey = -30; }
            if (side === 1) { ex = canvas.width + 30; ey = Math.random() * canvas.height; }
            if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + 30; }
            if (side === 3) { ex = -30; ey = Math.random() * canvas.height; }

            const rand = Math.random();
            let type: GeoEnemy['type'] = 'grunt';
            let hp = 1;
            let color = '#a855f7'; // Purple Square
            let score = 10;

            if (rand > 0.8) { type = 'speeder'; hp = 1; color = '#3b82f6'; score = 25; } // Blue Diamond
            if (rand > 0.95) { type = 'heavy'; hp = 5; color = '#ef4444'; score = 100; } // Red Hexagon

            enemiesRef.current.push({
                id: Math.random(),
                x: ex, y: ey,
                vx: 0, vy: 0,
                type, hp, color, score, angle: 0
            });
        }

        // --- UPDATE ENEMIES ---
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const e = enemiesRef.current[i];
            
            // Seeking logic
            const dx = p.x - e.x;
            const dy = p.y - e.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            let speed = 2.5;
            if (e.type === 'speeder') speed = 5;
            if (e.type === 'heavy') speed = 1.5;

            if (dist > 0) {
                e.vx += (dx / dist) * 0.15;
                e.vy += (dy / dist) * 0.15;
            }

            // Cap speed
            const eSpeed = Math.sqrt(e.vx*e.vx + e.vy*e.vy);
            if (eSpeed > speed) {
                e.vx = (e.vx / eSpeed) * speed;
                e.vy = (e.vy / eSpeed) * speed;
            }

            e.x += e.vx;
            e.y += e.vy;
            e.angle += 0.05;

            // Collision: Enemy vs Bullets
            let hit = false;
            for (let j = bulletsRef.current.length - 1; j >= 0; j--) {
                const b = bulletsRef.current[j];
                const bDx = b.x - e.x;
                const bDy = b.y - e.y;
                if (bDx*bDx + bDy*bDy < 500) { // Radius
                    e.hp--;
                    bulletsRef.current.splice(j, 1);
                    spawnParticles(b.x, b.y, e.color, 4);
                    hit = true;
                    if (e.hp <= 0) {
                        setSessionScore(s => s + e.score);
                        onCollectCoin(Math.ceil(e.score / 10));
                        spawnParticles(e.x, e.y, e.color, 15);
                        enemiesRef.current.splice(i, 1);
                        break;
                    }
                }
            }
            if (hit && e.hp <= 0) continue;

            // Collision: Enemy vs Player
            if (dist < 35) {
                spawnParticles(p.x, p.y, '#fbbf24', 10);
                // Hard bounce
                p.vx -= (e.x - p.x) * 1.5;
                p.vy -= (e.y - p.y) * 1.5;
                // Destroy enemy (kamikaze)
                enemiesRef.current.splice(i, 1);
                setSessionScore(s => Math.max(0, s - 50)); 
                continue;
            }

            // Draw Enemy
            ctx.shadowBlur = 15;
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 3;
            
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);
            ctx.beginPath();
            if (e.type === 'grunt') {
                ctx.rect(-12, -12, 24, 24); // Square
            } else if (e.type === 'speeder') {
                ctx.moveTo(0, -15); ctx.lineTo(12, 0); ctx.lineTo(0, 15); ctx.lineTo(-12, 0); ctx.closePath(); // Diamond
            } else {
                // Hexagon
                for(let k=0; k<6; k++) {
                    ctx.lineTo(18 * Math.cos(k * Math.PI/3), 18 * Math.sin(k * Math.PI/3));
                }
                ctx.closePath();
            }
            ctx.stroke();
            ctx.restore();
        }

        // --- UPDATE PARTICLES ---
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const pt = particlesRef.current[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= 0.03;
            
            if (pt.life <= 0) {
                particlesRef.current.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = pt.life;
            ctx.fillStyle = pt.color;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // --- DRAW TARGET CURSOR (Move Target) ---
        if (target) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(target.x, target.y, 20, 0, Math.PI*2);
            ctx.moveTo(target.x - 25, target.y); ctx.lineTo(target.x + 25, target.y);
            ctx.moveTo(target.x, target.y - 25); ctx.lineTo(target.x, target.y + 25);
            ctx.stroke();
        }

        // --- DRAW PLAYER ---
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#38bdf8'; // Sky blue glow
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        // Ship Shape (Triangle)
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -12);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.stroke();
        
        // Engine Flame
        if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) {
            ctx.beginPath();
            ctx.moveTo(-14, 0);
            ctx.lineTo(-24 - Math.random()*15, 0);
            ctx.strokeStyle = '#f472b6';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('touchstart', handleTouch);
        canvas.removeEventListener('touchmove', handleTouch);
        canvas.removeEventListener('touchend', handleTouch);
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(requestRef.current);
    };
  }, [isShooter]);

  // ----------------------------------------------------------------
  // SIMPLE GAMES LOGIC (Age < 10) - Unchanged
  // ----------------------------------------------------------------
  useEffect(() => {
      if (isShooter) return;

      const spawnItem = () => {
          if (Math.random() < 0.08) {
              const type = isTargetPractice ? 'target' : 'bubble';
              setSimpleItems(prev => [...prev, {
                  id: Date.now(),
                  x: 10 + Math.random() * 80,
                  y: isTargetPractice ? -10 : 110,
                  speed: isTargetPractice ? -(0.5 + Math.random()) : (0.2 + Math.random() * 0.3),
                  size: 50 + Math.random() * 30,
                  color: COLORS[Math.floor(Math.random() * COLORS.length)],
                  type
              }]);
          }
      };

      const loop = () => {
          setSimpleItems(prev => prev
              .map(i => ({ ...i, y: i.y - i.speed }))
              .filter(i => i.y > -20 && i.y < 120)
          );
          spawnItem();
          requestRef.current = requestAnimationFrame(loop);
      };
      
      requestRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(requestRef.current);
  }, [isShooter, isTargetPractice]);

  const handleSimpleClick = (id: number) => {
      handleInteraction();
      const item = simpleItems.find(i => i.id === id);
      if (item) {
          setSimpleItems(prev => prev.filter(i => i.id !== id));
          setSessionScore(s => s + 5);
          onCollectCoin(5);
          new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3').play().catch(() => {});
      }
  };

  return (
    <div 
        ref={containerRef}
        onClick={handleInteraction}
        className={`flex flex-col items-center justify-center h-full space-y-8 animate-fade-in relative overflow-hidden w-full rounded-[3rem] border-4 ${theme.panelBg} ${theme.panelBorder} backdrop-blur-3xl`}
    >
      
      {/* GAME LAYER */}
      <div className="absolute inset-0 z-10 overflow-hidden rounded-[2.8rem]">
         {isShooter ? (
             <canvas 
                ref={canvasRef} 
                className="block w-full h-full cursor-none bg-black touch-none" 
             />
         ) : (
             <div className="w-full h-full relative">
                 {/* Background Elements */}
                 <div className="absolute inset-0 pointer-events-none opacity-20">
                     {isTargetPractice ? (
                        <div className="flex flex-wrap gap-40 p-10 grid-cols-4">
                             {[...Array(6)].map((_, i) => <Target key={i} className="text-green-500/40 w-32 h-32 animate-spin-slow" />)}
                        </div>
                     ) : (
                        <div className="flex flex-wrap gap-24 p-24">
                            {[...Array(8)].map((_, i) => <Cloud key={i} className="text-white w-40 h-40 animate-pulse opacity-50" />)}
                        </div>
                     )}
                 </div>

                 {/* Interactive Items */}
                 {simpleItems.map(i => (
                     <div
                        key={i.id}
                        onMouseDown={(e) => { e.stopPropagation(); handleSimpleClick(i.id); }}
                        className={`absolute cursor-pointer active:scale-90 ${i.color} hover:brightness-125`}
                        style={{ left: `${i.x}%`, top: `${i.y}%`, width: i.size, height: i.size }}
                     >
                         {i.type === 'target' ? (
                            <div className="relative w-full h-full">
                                <Crosshair className="w-full h-full text-green-400" />
                            </div>
                         ) : (
                            <div className="w-full h-full rounded-full border-4 border-white/40 bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Star fill="currentColor" className="w-1/2 h-1/2 animate-pulse" />
                            </div>
                         )}
                     </div>
                 ))}
             </div>
         )}
      </div>

      {/* Score HUD */}
      <div className={`absolute top-8 right-8 z-30 bg-black/60 backdrop-blur-2xl px-6 py-3 rounded-2xl border ${isShooter ? 'border-purple-500' : 'border-yellow-400'} shadow-2xl flex items-center gap-4 pointer-events-none`}>
         <div className="flex flex-col text-right">
             <span className="text-white/60 font-black uppercase tracking-widest text-[10px] block">
                 Score
             </span>
             <span className={`${theme.textAccent} font-black text-2xl tabular-nums`}>{sessionScore}</span>
         </div>
         <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-yellow-400 text-black`}>
             <Gem size={20} /> 
         </div>
      </div>
      
      {/* Controls Hint for Shooter */}
      {isShooter && (
          <div className="absolute top-8 left-8 z-30 bg-black/40 px-4 py-2 rounded-xl text-white/50 text-xs font-bold border border-white/10 pointer-events-none">
              <span className="hidden md:inline">MOUSE to Move • ARROWS to Shoot</span>
              <span className="md:hidden">TOUCH & DRAG to Move • TAP WITH 2nd FINGER to Shoot</span>
          </div>
      )}

      {/* STOP BUTTON */}
      {onCancel && (
          <div className="absolute bottom-12 right-12 z-40">
              <button 
                  onClick={(e) => { e.stopPropagation(); onCancel(); }}
                  className="bg-red-500/80 hover:bg-red-500 text-white rounded-full p-4 shadow-lg border-2 border-red-300 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                  title="Cancel Production"
              >
                  <XCircle size={28} />
                  <span className="font-bold hidden md:inline">Stop</span>
              </button>
          </div>
      )}

      {/* CENTER OVERLAY: Icon & Text (Fades out on interaction) */}
      <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none transition-all duration-700 ${hasInteracted ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
          <div className="relative flex flex-col items-center">
            <div className="absolute inset-0 bg-white/5 blur-[100px] rounded-full transform scale-150 animate-pulse"></div>
            {getIcon()}
            
            <div className="text-center space-y-6 mt-8 px-8 max-w-2xl">
                <h2 className="text-5xl font-black text-white drop-shadow-2xl tracking-tighter italic">"{progress.message}"</h2>
                <div className="bg-black/30 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 shadow-2xl inline-block">
                    <p className={`${theme.textAccent} text-xl font-black uppercase tracking-widest animate-pulse`}>
                        {isShooter ? "🎯 ENGAGE SYSTEMS 🎯" : "✨ Tap the floating items! ✨"}
                    </p>
                </div>
            </div>
          </div>
      </div>

      {/* Progress Bar (Always visible at bottom) */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-xl px-10 z-30 pointer-events-none">
          <div className={`w-full bg-black/50 rounded-full h-8 border-2 ${theme.panelBorder} overflow-hidden shadow-2xl`}>
            <div 
              className={`h-full ${theme.buttonPrimary} transition-all duration-1000 ease-in-out flex items-center justify-end pr-2 relative`}
              style={{ width: `${getPercent()}%` }}
            >
                <div className="w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-progress-stripes opacity-50 absolute inset-0"></div>
                <Sparkles className="relative z-10 w-4 h-4 text-white animate-spin" />
            </div>
          </div>
      </div>
    </div>
  );
};
