// Enhanced Dragon Ball style Kamehameha visual effects
/**
 * Dragon Ball‑style Kamehameha VFX engine.
 * Renders the charging energy sphere, beam, lightning, and shock‑wave
 * on an HTML canvas based on hand‑pose gesture state.
 */
export class KamehamehaEffects {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.beamParticles = [];
        this.energyRings = [];
        this.sparkles = [];
        this.environmentDebris = [];
        this.energyBeam = null;
        this.energySphere = null;
        this.glowEffect = null;
        this.shockwaveRings = [];
        this.beamTrails = [];
        this.explosionParticles = [];
        this.time = 0;
        this.lastTime = Date.now();
        
        // Animation timing
        this.deltaTime = 0;
        this.frameCount = 0;

        // Track previous gesture state so we can clear effects on transitions
        this.previousGestureState = null;
    }

    // Draw energy sphere with enhanced Dragon Ball charging effects
    drawEnergySphere(hands, chargingProgress, gestureData = {}) {
        if (!hands || hands.length !== 2) return;

        const hand1 = hands[0];
        const hand2 = hands[1];
        const wrist1 = hand1.keypoints.find(kp => kp.name === 'wrist');
        const wrist2 = hand2.keypoints.find(kp => kp.name === 'wrist');

        if (!wrist1 || !wrist2) return;

        // Use energy sphere center from gesture data if available (positioned in palm), 
        // otherwise fall back to wrist center calculation
        let centerX, centerY;
        if (gestureData.energySphereCenter) {
            centerX = gestureData.energySphereCenter.x;
            centerY = gestureData.energySphereCenter.y;
        } else {
            // Fallback to wrist center calculation
            centerX = (wrist1.x + wrist2.x) / 2;
            centerY = (wrist1.y + wrist2.y) / 2;
        }

        // Calculate energy sphere radius based on charging progress
        const baseRadius = 20;
        const maxRadius = 60;
        const radius = baseRadius + (maxRadius - baseRadius) * chargingProgress;
        
        // Update internal animation time
        this.update();
        
        // Create organic energy sparks
        const energySparks = this.createEnergySparks(centerX, centerY, radius, chargingProgress);
        
        // Draw the main energy sphere with multiple layers
        this.drawMainEnergySphere(centerX, centerY, radius, chargingProgress);
        
        // Draw energy sparks
        this.drawEnergySparks(energySparks);
        
        // Draw dynamic lightning effects around the energy sphere
        this.drawEnergyLightning(centerX, centerY, radius, chargingProgress);
        
        // Add energy field distortion effect
        this.drawEnergyField(centerX, centerY, radius, chargingProgress);
    }

    // Draw the main energy sphere with layered effects
    drawMainEnergySphere(centerX, centerY, radius, chargingProgress) {
        this.ctx.save();
        
        // Outer energy field (more concentrated, reduced from 2x to 1.3x radius)
        this.ctx.globalAlpha = 0.1 * chargingProgress;
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.shadowBlur = 25; // Reduced from 40
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 0.9, 0, Math.PI * 2); // Reduced from 2x
        this.ctx.fill();
        
        // Middle energy layer (slightly smaller, reduced from 1.4x to 1.15x)
        this.ctx.globalAlpha = 0.3 * chargingProgress;
        this.ctx.shadowBlur = 18; // Reduced from 25
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 1, 0, Math.PI * 2); // Reduced from 1.4x
        this.ctx.fill();
        
        // Inner bright core
        this.ctx.globalAlpha = 0.6 * chargingProgress;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.shadowBlur = 12; // Reduced from 15
        this.ctx.shadowColor = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 1, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Central bright spot
        this.ctx.globalAlpha = 0.95 * chargingProgress;
        this.ctx.shadowBlur = 5;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 0.9, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    // Draw energy field distortion effect with enhanced Dragon Ball Z characteristics
    drawEnergyField(centerX, centerY, radius, chargingProgress) {
        if (chargingProgress < 0.3) return;
        
        this.ctx.save();
        
        // Enhanced energy rings with multiple layers and colors - more concentrated
        const ringCount = 2; // Increased for more dramatic effect
        const intensityMultiplier = Math.min(chargingProgress * 1.5, 1.0);
        
        for (let i = 0; i < ringCount; i++) {
            // Create different wave patterns for each ring
            const ringPhase = (this.time * (1.5 + i * 0.3) + i * 1.2) % (Math.PI * 2);
            const pulsePhase = (this.time * 3 + i * 0.8) % (Math.PI * 2);
            
            // Dynamic ring radius with multiple wave components - reduced expansion for concentration
            const baseRadius = radius * (1.1 + i * 0.15); // Reduced from (1.3 + i * 0.4) to (1.1 + i * 0.15)
            const wave1 = Math.sin(ringPhase) * 8 * intensityMultiplier; // Reduced from 15 to 8
            const wave2 = Math.sin(pulsePhase * 2.3) * 4 * intensityMultiplier; // Reduced from 8 to 4
            const ringRadius = baseRadius + wave1 + wave2;
            
            // Enhanced opacity with better distribution
            const baseOpacity = (0.6 - i * 0.08) * chargingProgress;
            const pulseOpacity = Math.abs(Math.sin(pulsePhase)) * 0.4 + 0.6;
            const ringOpacity = baseOpacity * pulseOpacity * intensityMultiplier;
            
            // Dynamic color based on ring index and charging progress
            const colors = ['#FFFFFF', '#00FFFF', '#87CEEB', '#1E90FF', '#4169E1'];
            const ringColor = colors[i] || '#00FFFF';
            
            // Variable line width for depth effect
            const lineWidth = Math.max(1, (4 - i * 0.5) * intensityMultiplier);
            
            this.ctx.globalAlpha = ringOpacity;
            this.ctx.strokeStyle = ringColor;
            this.ctx.lineWidth = lineWidth;
            this.ctx.shadowBlur = 12 + i * 2;
            this.ctx.shadowColor = ringColor;
            
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Add secondary ring effect for inner rings (more energy density)
            if (i < 2 && chargingProgress > 0.6) {
                const secondaryRadius = ringRadius * 0.85;
                const secondaryOpacity = ringOpacity * 0.5;
                
                this.ctx.globalAlpha = secondaryOpacity;
                this.ctx.lineWidth = lineWidth * 0.6;
                this.ctx.shadowBlur = 6;
                
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, secondaryRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
        
        // Add energy distortion waves at high charging levels
        if (chargingProgress > 0.7) {
            this.drawEnergyDistortionWaves(centerX, centerY, radius, chargingProgress);
        }
        
        this.ctx.restore();
    }
    
    // Draw additional energy distortion waves for high charging levels
    drawEnergyDistortionWaves(centerX, centerY, radius, chargingProgress) {
        const waveCount = 8;
        const distortionIntensity = (chargingProgress - 0.7) / 0.3; // 0 to 1 for progress 0.7 to 1.0
        
        for (let i = 0; i < waveCount; i++) {
            const angle = (i / waveCount) * Math.PI * 2;
            const wavePhase = this.time * 4 + i * 0.5;
            const waveDistance = radius * (2 + Math.sin(wavePhase) * 0.8) * distortionIntensity;
            
            const startX = centerX + Math.cos(angle) * radius * 1.2;
            const startY = centerY + Math.sin(angle) * radius * 1.2;
            const endX = centerX + Math.cos(angle) * waveDistance;
            const endY = centerY + Math.sin(angle) * waveDistance;
            
            const waveOpacity = 0.4 * distortionIntensity * Math.abs(Math.sin(wavePhase));
            
            this.ctx.globalAlpha = waveOpacity;
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#FFFFFF';
            this.ctx.lineCap = 'round';
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
    }

    // Update internal animation state
    update() {
        const currentTime = Date.now();
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.time = currentTime * 0.001; // Convert to seconds
        this.frameCount++;
    }

    // Create energy sparks around the sphere with organic rotation
    createEnergySparks(centerX, centerY, radius, chargingProgress) {
        const sparkCount = Math.floor(6 + 12 * chargingProgress);
        const energySparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            // Create random orbital parameters for each spark
            const baseAngle = Math.random() * Math.PI * 2; // Random starting angle
            const orbitSpeed = 0.8 + Math.random() * 1.4; // Random orbit speed
            const orbitRadius = radius * (1 + Math.random() * 0.8); // Random orbit distance
            const wobble = Math.sin(this.time * (2 + Math.random() * 3) + i * 1.7) * 0.2; // Random wobble
            
            // Calculate current position with organic movement
            const currentAngle = baseAngle + this.time * orbitSpeed + wobble;
            const currentRadius = orbitRadius + Math.sin(this.time * 2.3 + i) * radius * 0.3;
            
            const x = centerX + Math.cos(currentAngle) * currentRadius;
            const y = centerY + Math.sin(currentAngle) * currentRadius;
            
            // Random spark properties
            const sparkSize = (2 + Math.random() * 4) * chargingProgress;
            const sparkLife = 0.7 + Math.random() * 0.6;
            const sparkIntensity = 0.6 + Math.random() * 0.4;
            
            energySparks.push({
                x, y,
                size: sparkSize,
                opacity: sparkIntensity * chargingProgress * sparkLife,
                color: this.getRandomSparkColor(),
                angle: currentAngle,
                orbitSpeed: orbitSpeed,
                orbitRadius: orbitRadius,
                wobblePhase: i * 1.7,
                life: sparkLife,
                pulsePhaase: Math.random() * Math.PI * 2, // Random pulse timing
                twinkle: Math.random() > 0.7 // 30% chance to twinkle
            });
        }
        
        return energySparks;
    }

    // Get random spark color with weighted distribution
    getRandomSparkColor() {
        const colors = [
            '#FFFFFF',  // White (most common)
            '#00FFFF',  // Cyan
            '#87CEEB',  // Sky blue
            '#1E3A8A',  // Deep blue
            '#003366'   // Navy blue
        ];
        
        // Weighted selection favoring white and cyan
        const weights = [0.4, 0.25, 0.15, 0.1, 0.1];
        const random = Math.random();
        let weightSum = 0;
        
        for (let i = 0; i < weights.length; i++) {
            weightSum += weights[i];
            if (random <= weightSum) {
                return colors[i];
            }
        }
        
        return colors[0]; // Fallback to white
    }

    // Draw energy sparks as organic glowing points
    drawEnergySparks(sparks) {
        sparks.forEach(spark => {
            this.ctx.save();
            
            // Apply twinkle effect by modulating opacity
            let currentOpacity = spark.opacity;
            if (spark.twinkle) {
                const twinkleEffect = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 8 + spark.pulsePhaase));
                currentOpacity *= twinkleEffect;
            }
            
            // Add pulse effect
            const pulseEffect = 0.7 + 0.3 * Math.sin(this.time * 4 + spark.pulsePhaase);
            const currentSize = spark.size * pulseEffect;
            
            // Set up glow effect with multiple layers
            this.ctx.globalAlpha = currentOpacity * 0.3;
            this.ctx.fillStyle = spark.color;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = spark.color;
            
            // Outer glow
            this.ctx.beginPath();
            this.ctx.arc(spark.x, spark.y, currentSize * 2.5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Middle glow
            this.ctx.globalAlpha = currentOpacity * 0.6;
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.arc(spark.x, spark.y, currentSize * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner bright core
            this.ctx.globalAlpha = currentOpacity;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.shadowBlur = 4;
            this.ctx.shadowColor = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(spark.x, spark.y, currentSize * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add small radiating lines for sparkle effect
            if (currentOpacity > 0.5) {
                this.ctx.globalAlpha = currentOpacity * 0.8;
                this.ctx.strokeStyle = spark.color;
                this.ctx.lineWidth = 1;
                this.ctx.lineCap = 'round';
                this.ctx.shadowBlur = 2;
                
                const sparkleLines = 4;
                for (let i = 0; i < sparkleLines; i++) {
                    const lineAngle = (i / sparkleLines) * Math.PI * 2 + this.time * 2;
                    const lineLength = currentSize * 1.8;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(
                        spark.x + Math.cos(lineAngle) * currentSize * 0.3,
                        spark.y + Math.sin(lineAngle) * currentSize * 0.3
                    );
                    this.ctx.lineTo(
                        spark.x + Math.cos(lineAngle) * lineLength,
                        spark.y + Math.sin(lineAngle) * lineLength
                    );
                    this.ctx.stroke();
                }
            }
            
            this.ctx.restore();
        });
    }

    // Draw dynamic Dragon Ball style lightning around the energy sphere
    drawEnergyLightning(centerX, centerY, radius, chargingProgress) {
        if (chargingProgress < 0.2) return; // Lightning starts appearing at 20% charge
        
        this.ctx.save();
        
        // Calculate lightning intensity based on charging progress
        const lightningIntensity = (chargingProgress - 0.2) / 0.8; // 0 to 1 for progress 0.2 to 1.0
        
        // Draw radiant blue lightning tendrils that extend and retract
        this.drawRadiantLightningTendrils(centerX, centerY, radius, lightningIntensity, chargingProgress);
        
        // Draw orbital lightning arcs that gravitate around the energy sphere
        this.drawOrbitalLightningArcs(centerX, centerY, radius, lightningIntensity, chargingProgress);
        
        // Add pulsating energy field lightning
        this.drawPulsatingEnergyField(centerX, centerY, radius, lightningIntensity, chargingProgress);
        
        // Add occasional major lightning bursts at high charge levels
        if (chargingProgress > 0.7) {
            this.drawMajorLightningBursts(centerX, centerY, radius, chargingProgress);
        }
        
        this.ctx.restore();
    }
    
    // Generate a jagged lightning path with realistic electric arc characteristics
    generateLightningPath(startX, startY, angle, length, segments, rng) {
        const path = [{ x: startX, y: startY }];
        const segmentLength = length / segments;
        
        let currentX = startX;
        let currentY = startY;
        let currentAngle = angle;
        
        for (let i = 1; i <= segments; i++) {
            // Add random deviation to create jagged appearance
            const deviation = (rng() - 0.5) * Math.PI * 0.4; // Up to ±36° deviation
            currentAngle += deviation;
            
            // Calculate next point
            const stepLength = segmentLength * (0.7 + 0.6 * rng()); // Vary segment length
            currentX += Math.cos(currentAngle) * stepLength;
            currentY += Math.sin(currentAngle) * stepLength;
            
            path.push({ x: currentX, y: currentY });
            
            // Gradually return angle toward original direction (prevents excessive wandering)
            currentAngle = currentAngle * 0.8 + angle * 0.2;
        }
        
        return path;
    }
    
    // Draw lightning path with multiple layers for glow effect
    drawLightningPath(path, intensity, type = 'main') {
        if (path.length < 2) return;
        
        // Determine colors and sizes based on type and intensity
        let colors, lineWidths, blurLevels;
        
        if (type === 'main') {
            colors = ['#FFFFFF', '#87CEEB', '#4169E1']; // White to blue gradient
            lineWidths = [2, 1.5, 1]; // Always thin - fixed widths
            blurLevels = [8 + intensity * 3, 5 + intensity * 2, 2 + intensity];
        } else { // branch
            colors = ['#FFFFFF', '#87CEEB'];
            lineWidths = [1.5, 1]; // Always thin branches - fixed widths
            blurLevels = [6 + intensity * 2, 3 + intensity];
        }
        
        // Draw multiple layers for glow effect (outer to inner)
        for (let layer = colors.length - 1; layer >= 0; layer--) {
            this.ctx.strokeStyle = colors[layer];
            this.ctx.lineWidth = lineWidths[layer];
            this.ctx.shadowBlur = blurLevels[layer];
            this.ctx.shadowColor = colors[layer];
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.globalAlpha = 0.8 + 0.2 * intensity;
            
            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x, path[0].y);
            
            for (let i = 1; i < path.length; i++) {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
            
            this.ctx.stroke();
        }
    }
    
    // Draw major lightning bursts for high energy levels
    drawMajorLightningBursts(centerX, centerY, radius, chargingProgress) {
        const burstIntensity = (chargingProgress - 0.7) / 0.3; // 0 to 1 for progress 0.7 to 1.0
        
        // Occasional massive lightning discharge
        const burstPhase = (this.time * 2.5) % 1;
        if (burstPhase < 0.15) { // 15% of time cycle
            const burstCount = 3 + Math.floor(4 * burstIntensity);
            
            for (let i = 0; i < burstCount; i++) {
                const angle = (i / burstCount) * Math.PI * 2 + this.time * 0.5;
                const burstLength = radius * (2 + 2 * burstIntensity);
                
                // Generate dramatic burst path
                const rng = this.seededRandom(i + Math.floor(this.time * 5));
                const startX = centerX + Math.cos(angle) * radius * 0.9;
                const startY = centerY + Math.sin(angle) * radius * 0.9;
                
                const burstPath = this.generateLightningPath(
                    startX, startY, angle, burstLength, 
                    12 + Math.floor(6 * burstIntensity), rng
                );
                
                // Draw with enhanced intensity
                this.ctx.globalAlpha = 0.9;
                this.drawLightningPath(burstPath, Math.min(1.0, burstIntensity * 1.5), 'main');
            }
        }
    }
    
    // Simple seeded random number generator for consistent lightning patterns
    seededRandom(seed) {
        let currentSeed = seed;
        return function() {
            const x = Math.sin(currentSeed++) * 10000;
            return x - Math.floor(x);
        };
    }

    // Enhanced energy beam with Dragon Ball characteristics
    drawEnergyBeam(hands, firingFrameCount, firingDirection = null) {
        if (!hands || hands.length !== 2) return;

        // Save canvas state at the beginning to prevent canvas corruption
        this.ctx.save();

        const hand1 = hands[0];
        const hand2 = hands[1];
        const wrist1 = hand1.keypoints.find(kp => kp.name === 'wrist');
        const wrist2 = hand2.keypoints.find(kp => kp.name === 'wrist');

        if (!wrist1 || !wrist2) {
            // Restore canvas state before returning
            this.ctx.restore();
            return;
        }

        // Calculate beam origin (between hands)
        const originX = (wrist1.x + wrist2.x) / 2;
        const originY = (wrist1.y + wrist2.y) / 2;

        // 3D perspective enhancement
        let perspective = 1, dz = 0;
        let beamAngle = 0;
        if (firingDirection && firingDirection.vector3D) {
            const { x: dx, y: dy, z } = firingDirection.vector3D;
            dz = z;
            // 2D angle for canvas - account for mirrored canvas (scaleX(-1))
            beamAngle = Math.atan2(dy, dx);
            // Since canvas is mirrored with scaleX(-1), we need to flip the x-component of the angle
            beamAngle = Math.PI - beamAngle;
            // Perspective: dz > 0 means toward camera, scale up width/glow
            perspective = 1 + Math.max(0, dz) * 2.2; // exaggerate for effect
        } else if (firingDirection && typeof firingDirection.angle === 'number') {
            beamAngle = firingDirection.angle;
            // Since canvas is mirrored with scaleX(-1), we need to flip the angle
            beamAngle = Math.PI - beamAngle;
        }

        // DEBUG LOGS FOR BEAM DIRECTION
        console.log(`🔥 BEAM DEBUG: origin=(${originX.toFixed(1)}, ${originY.toFixed(1)}), raw_angle=${firingDirection?.angle ? (firingDirection.angle * 180 / Math.PI).toFixed(1) : 'none'}°, mirrored_angle=${(beamAngle * 180 / Math.PI).toFixed(1)}°, vector=${firingDirection?.vector ? `(${firingDirection.vector.x.toFixed(2)}, ${firingDirection.vector.y.toFixed(2)})` : 'none'}`);

        // Beam parameters - Slowed for better user experience
        const maxBeamLength = this.canvas.width * 1.2;
        const growthFrames = Math.ceil(maxBeamLength / 8); // Frames needed to reach full length
        const sustainFrames = 30; // Frames to sustain at full length
        const erasureFrames = 60; // Frames for traveling erasure effect
        
        // Calculate beam phases
        const totalBeamFrames = growthFrames + sustainFrames + erasureFrames;
        let beamLength, erasureProgress = 0;
        
        if (firingFrameCount <= growthFrames) {
            // Growth phase: beam extends toward target
            beamLength = Math.min(firingFrameCount * 8, maxBeamLength);
        } else if (firingFrameCount <= growthFrames + sustainFrames) {
            // Sustain phase: beam at full length
            beamLength = maxBeamLength;
        } else if (firingFrameCount <= totalBeamFrames) {
            // Erasure phase: beam travels away from origin
            beamLength = maxBeamLength;
            const erasureFrameCount = firingFrameCount - growthFrames - sustainFrames;
            erasureProgress = erasureFrameCount / erasureFrames; // 0 to 1
        } else {
            // Beam completely disappeared
            this.ctx.restore();
            return;
        }
        
        // Calculate beam width with cylindrical taper
        const sphereMaxRadius = 90; // Increased from 80 to 90 for an even larger beam base
        const sphereInnerCoreMultiplier = 0.9; // Increased from 0.85 to 0.9 for more power
        
        // Beam starts wide and tapers as it extends
        const sphereRadius = sphereMaxRadius;
        const sphereInnerRadius = sphereRadius * sphereInnerCoreMultiplier;
        // Dramatically increase beam thickness
        const baseBeamWidth = sphereInnerRadius * 10; // Increased from 8 to 10 for a much thicker beam
        
        // Add cylindrical taper effect - reduce taper to keep beam wider throughout
        const taperFactor = 1 - (beamLength / maxBeamLength) * 0.03; // Reduced from 0.05 to 0.03 for only 3% taper
        const dynamicBeamWidth = baseBeamWidth * perspective * taperFactor;
        const dynamicGlow = perspective * 0.25; // Reduced from 0.4 to 0.25 to keep glow very close to beam (within 5px)

        // Visual feedback: lens flare if beam is coming at viewer - preserve video visibility
        if (dz > 0.5) {
            this.ctx.save();
            
            // Use additive blending to preserve video underneath
            this.ctx.globalCompositeOperation = 'screen';
            
            // Keep flare effects tight within 5px of beam
            const flareRadius = 25 * perspective; // Reduced from 30 to 25
            const flareGradient = this.ctx.createRadialGradient(
                originX, originY, 0,
                originX, originY, flareRadius
            );
            flareGradient.addColorStop(0, 'rgba(255,255,255,0.7)'); // Increased opacity from 0.6 to 0.7
            flareGradient.addColorStop(0.3, 'rgba(150,230,255,0.4)'); // Increased brightness and opacity
            flareGradient.addColorStop(0.6, 'rgba(100,200,255,0.2)'); // Adjusted middle stop
            flareGradient.addColorStop(1, 'rgba(100,200,255,0)');
            this.ctx.globalAlpha = 0.6 * Math.min(1, dz); // Increased opacity from 0.5 to 0.6
            this.ctx.beginPath();
            this.ctx.arc(originX, originY, flareRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = flareGradient;
            this.ctx.fill();
            this.ctx.restore();
        }

        // 1. Draw shockwave rings at origin
        this.drawShockwaveRings(originX, originY, firingFrameCount);

        // 2. Draw beam trails (afterglow effect)
        this.drawBeamTrails(originX, originY, beamLength, dynamicBeamWidth, beamAngle, firingFrameCount, erasureProgress);

        // 3. Draw main beam with flowing energy texture and irregular edges
        this.ctx.save();
        this.ctx.shadowBlur = dynamicGlow;
        this.ctx.shadowColor = '#00FFFF';
        this.drawMainBeam(originX, originY, beamLength, dynamicBeamWidth/8, beamAngle, firingFrameCount, erasureProgress);
        this.ctx.restore();


        // 10. Draw impact effects when beam reaches target
        if (beamLength >= maxBeamLength * 0.8) {
            const impactX = originX + Math.cos(beamAngle) * beamLength;
            const impactY = originY + Math.sin(beamAngle) * beamLength;
            this.drawEnhancedBeamImpact(impactX, impactY, firingFrameCount);
        }

        // Restore canvas state at the end to prevent canvas corruption
        this.ctx.restore();
    }

    // Draw pulsating shockwave rings at beam origin - Enhanced with energy sphere colors
    drawShockwaveRings(originX, originY, frameCount) {
        const ringCount = 3; // Reduced from 4 to 3 for even more concentration
        
        for (let i = 0; i < ringCount; i++) {
            const ringProgress = (frameCount * 0.5 + i * 0.1) % 1; // Faster animation for more frequent rings
            const ringRadius = ringProgress * 5; // Reduced from 12 to 5 to keep rings within 5px
            const ringOpacity = (1 - ringProgress) * 1.0; // Increased from 0.9 to 1.0 for maximum visibility
            
            this.ctx.save();
            
            // Use additive blending to preserve video underneath
            this.ctx.globalCompositeOperation = 'screen';
            
            // Alternate between cyan and white rings for energy sphere consistency
            const ringColor = i % 2 === 0 ? '#00FFFF' : '#FFFFFF';
            this.ctx.strokeStyle = `rgba(${i % 2 === 0 ? '0, 255, 255' : '255, 255, 255'}, ${ringOpacity})`;
            this.ctx.lineWidth = 3 * (1 - ringProgress); // Reduced from 4 to 3 for thinner lines that won't exceed 5px
            this.ctx.shadowBlur = 3; // Reduced from 5 to 3 to keep glow tighter to ring
            this.ctx.shadowColor = ringColor;
            this.ctx.beginPath();
            this.ctx.arc(originX, originY, ringRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }    // Draw beam trail effects with traveling wave fade - Enhanced to match energy sphere colors
    drawBeamTrails(originX, originY, beamLength, beamWidth, angle, frameCount, erasureProgress = 0) {
        const trailCount = 2; // Reduced from 3 to 2 for tighter control
        
        // Calculate traveling wave parameters for trails
        const travelSpeed = 12; // Match main beam speed
        const travelDistance = frameCount * travelSpeed;
        
        // Calculate erasure cutoff - beam disappears progressively from origin to tip
        const erasureCutoff = beamLength * erasureProgress;
        
        for (let i = 0; i < trailCount; i++) {
            const trailDelay = i * 0.08; // Tighter grouping (was 0.12)
            const trailLength = beamLength * (1 - trailDelay * 0.5); // Keep very close to main beam (was 0.7)
            const baseOpacity = 0.15 * (1 - trailDelay); // Slightly increased opacity for better visibility
            
            if (trailLength > 0) {
                this.ctx.save();
                
                // Use additive blending to preserve video underneath
                this.ctx.globalCompositeOperation = 'screen';
                
                // Apply rotation to draw beam in correct direction
                this.ctx.translate(originX, originY);
                this.ctx.rotate(angle);
                
                // Create gradient with traveling wave fade effect
                const segmentSize = 8;
                for (let x = 0; x < trailLength; x += segmentSize) {
                    // Skip segments that have been erased (traveling erasure effect)
                    if (x < erasureCutoff) continue;
                    
                    const segmentProgress = x / trailLength;
                    
                    // Progressive fade from origin to tip - improved persistence
                    const fadeFactor = Math.max(0.4, 1 - Math.pow(segmentProgress, 1.25));
                    
                    // Dramatically reduce wave effect
                    const distanceFromWave = Math.abs(x - travelDistance * (1 - trailDelay));
                    let waveIntensity = 0.30; // Was 0.50
                    if (distanceFromWave < 40) { // Was 60
                        const waveProgress = distanceFromWave / 40;
                        waveIntensity = 1.0 + 0.08 * (1 - waveProgress); // Was 0.2
                    }
                    
                    const trailOpacity = baseOpacity * fadeFactor * waveIntensity;
                    
                    if (trailOpacity > 0.01) {
                        const trailGradient = this.ctx.createLinearGradient(
                            x, -beamWidth/2 * 0.1, // Tighter to beam
                            x, beamWidth/2 * 0.1
                        );
                        
                        // Use energy sphere color palette: cyan to white to cyan
                        trailGradient.addColorStop(0, `rgba(0, 255, 255, 0)`); // Cyan edges
                        trailGradient.addColorStop(0.5, `rgba(255, 255, 255, ${trailOpacity})`); // White center
                        trailGradient.addColorStop(1, `rgba(0, 255, 255, 0)`); // Cyan edges
                        
                        this.ctx.fillStyle = trailGradient;
                        this.ctx.fillRect(x, -beamWidth/2 * 0.1, segmentSize, beamWidth * 0.2);
                    }
                }
                
                this.ctx.restore();
            }
        }
    }

    // Draw main beam with traveling energy wave effect and progressive fade
    drawMainBeam(originX, originY, beamLength, beamWidth, angle, frameCount, erasureProgress = 0) {
        const segmentSize = 8; // Smaller segments for more detail
        const flowOffset = (frameCount * 1.5) % segmentSize; // Slower flow for better visibility
        
        // Calculate traveling wave effect parameters
        const travelSpeed = 12; // Pixels per frame for traveling wave
        const waveLength = 40; // Was 80, now much shorter
        const travelDistance = frameCount * travelSpeed; // How far the wave has traveled
        
        // Calculate erasure cutoff - beam disappears progressively from origin to tip
        const erasureCutoff = beamLength * erasureProgress;
        
        this.ctx.save();
        
        // Use additive blending to preserve video underneath
        this.ctx.globalCompositeOperation = 'screen';
        
        // Apply rotation to draw beam in correct direction
        this.ctx.translate(originX, originY);
        this.ctx.rotate(angle);
        
        for (let x = 0; x < beamLength; x += segmentSize) {
            // Skip segments that have been erased (traveling erasure effect)
            if (x < erasureCutoff) continue;
            
            const segmentProgress = x / beamLength;
            const flowX = x + flowOffset;
            
            // Apply cylindrical taper
            const taperFactor = 1 - segmentProgress * 0.25; // Reduced from 0.3 to 0.25 for a more gradual taper
            const currentWidth = beamWidth * taperFactor;
            
            // Minimize edge variation to keep effects within 5px
            const edgeVariation1 = Math.sin((flowX * 0.05) + this.time * 3) * currentWidth * 0.02; // Reduced from 0.04 to 0.02
            const edgeVariation2 = Math.sin((flowX * 0.08) + this.time * 4.5) * currentWidth * 0.02; // Reduced from 0.03 to 0.02
            const topEdge = -currentWidth/2 + edgeVariation1;
            const bottomEdge = currentWidth/2 + edgeVariation2;
            
            // Reduce flowing texture effect
            const flowIntensity = 0.9 + 0.1 * Math.sin((flowX * 0.08) + this.time * 5); // Was 0.4
            
            // Reduce traveling wave intensity
            const distanceFromWaveCenter = Math.abs(x - travelDistance);
            let travelingWaveIntensity = 1.0;
            
            if (distanceFromWaveCenter < waveLength) {
                // Create a wave that peaks at the center and fades to the edges (reduced from 1.5 to 0.3)
                const waveProgress = distanceFromWaveCenter / waveLength;
                travelingWaveIntensity = 1.0 + 0.08 * (1 - waveProgress) * Math.cos(waveProgress * Math.PI);
            }
            
            // Progressive fade from origin to tip - improved beam persistence toward target
            const fadeProgress = segmentProgress;
            const fadeFactor = Math.max(0.4, 1 - Math.pow(fadeProgress, 1.2)); // Reduced power curve for better persistence
            
            // Combine all intensity factors
            const segmentAlpha = fadeFactor * travelingWaveIntensity;
            
            // Multi-layer beam with deeper blue edges and bright white core
            const segmentGradient = this.ctx.createLinearGradient(
                x, topEdge,
                x, bottomEdge
            );
            
            // Dragon Ball style gradient: Deep blue → Sky blue → White → Sky blue → Deep blue
            segmentGradient.addColorStop(0, `rgba(30, 58, 138, ${segmentAlpha * flowIntensity * 0.6})`); // Deep blue edge
            segmentGradient.addColorStop(0.15, `rgba(65, 105, 225, ${segmentAlpha * flowIntensity * 0.7})`); // Royal blue
            segmentGradient.addColorStop(0.35, `rgba(135, 206, 235, ${segmentAlpha * flowIntensity * 0.8})`); // Sky blue
            segmentGradient.addColorStop(0.5, `rgba(255, 255, 255, ${segmentAlpha * flowIntensity * 0.95})`); // Bright white core
            segmentGradient.addColorStop(0.65, `rgba(135, 206, 235, ${segmentAlpha * flowIntensity * 0.8})`); // Sky blue
            segmentGradient.addColorStop(0.85, `rgba(65, 105, 225, ${segmentAlpha * flowIntensity * 0.7})`); // Royal blue
            segmentGradient.addColorStop(1, `rgba(30, 58, 138, ${segmentAlpha * flowIntensity * 0.6})`); // Deep blue edge
            
            this.ctx.fillStyle = segmentGradient;
            this.ctx.shadowBlur = 14 * travelingWaveIntensity; // Was 20
            this.ctx.shadowColor = '#87CEEB'; // Sky blue glow
            
            // Draw irregular beam segment
            this.ctx.beginPath();
            this.ctx.moveTo(x, topEdge);
            this.ctx.lineTo(x + segmentSize, topEdge);
            this.ctx.lineTo(x + segmentSize, bottomEdge);
            this.ctx.lineTo(x, bottomEdge);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }


    // Enhanced beam impact with explosion effects - Updated with energy sphere color palette
    drawEnhancedBeamImpact(x, y, frameCount) {
        const impactRadius = 70 + Math.sin(frameCount * 0.3) * 15; // Increased base radius from 60 to 70, reduced variation
        
        this.ctx.save();
        
        // Use additive blending to preserve video underneath
        this.ctx.globalCompositeOperation = 'screen';
        
        // 1. Main explosion core with cyan-white energy sphere colors
        const explosionGradient = this.ctx.createRadialGradient(
            x, y, 0,
            x, y, impactRadius
        );
        
        explosionGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)'); // Increased from 0.6 to 0.7
        explosionGradient.addColorStop(0.25, 'rgba(150, 220, 255, 0.5)'); // Brighter blue with higher opacity
        explosionGradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.4)'); // Increased from 0.3 to 0.4
        explosionGradient.addColorStop(0.75, 'rgba(65, 105, 225, 0.2)'); // Increased from 0.15 to 0.2
        explosionGradient.addColorStop(1, 'rgba(0, 0, 139, 0)'); // Dark blue fade
        
        this.ctx.fillStyle = explosionGradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, impactRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 2. Explosion sparks with cyan energy
        const sparkCount = 10; // Reduced from 12 to 10 for less cluttered impact
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2;
            const sparkLength = 25 + Math.random() * 30; // Reduced from 30+40 to 25+30 for tighter sparks
            const sparkX = x + Math.cos(angle) * sparkLength;
            const sparkY = y + Math.sin(angle) * sparkLength;
            
            // Alternate between white and cyan sparks
            const sparkColor = i % 2 === 0 ? '255, 255, 255' : '0, 255, 255';
            this.ctx.strokeStyle = `rgba(${sparkColor}, ${0.4 + Math.random() * 0.3})`;
            this.ctx.lineWidth = 2 + Math.random() * 3;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = i % 2 === 0 ? '#FFFFFF' : '#00FFFF';
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(sparkX, sparkY);
            this.ctx.stroke();
        }
        
        // 3. Impact shockwave with cyan glow
        // const shockwaveRadius = impactRadius * 1.5;
        // this.ctx.strokeStyle = `rgba(0, 255, 255, 0.5)`; // Cyan shockwave
        // this.ctx.lineWidth = 5;
        // this.ctx.shadowBlur = 15;
        // this.ctx.shadowColor = '#00FFFF';
        // this.ctx.beginPath();
        // this.ctx.arc(x, y, shockwaveRadius, 0, Math.PI * 2);
        // this.ctx.stroke();
        
        this.ctx.restore();
    }

    // Clear all effects
    clearEffects() {
        this.particles = [];
        this.energyBeam = null;
        this.energySphere = null;
    }

    // Main render function with enhanced Dragon Ball effects
    render(gestureState, gestureData, hands) {
        // Clear lingering sphere effects the moment we switch from charging → firing
        if (this.previousGestureState === 'charging' && gestureState === 'firing') {
            this.clearEffects();
        }
        // Update animation timing
        this.update();
        
        switch (gestureState) {
            case 'charging':
                this.drawEnergySphere(hands, gestureData.chargingProgress, gestureData);
                break;
            case 'firing':
                this.drawEnergyBeam(hands, gestureData.firingFrameCount, gestureData.firingDirection);
                break;
            case 'idle':
            case 'positioning':
                // // Draw subtle positioning guide
                // if (gestureState === 'positioning') {
                //     this.drawPositioningGuide(hands);
                // }
                break;
        }
        // Remember current state for next frame
        this.previousGestureState = gestureState;
    }

    // Draw radiant blue lightning tendrils that extend and retract from the core
    drawRadiantLightningTendrils(centerX, centerY, radius, intensity, chargingProgress) {
        const tendrilCount = Math.floor(8 + 6 * intensity); // 8 to 14 tendrils
        
        for (let i = 0; i < tendrilCount; i++) {
            // Create pulsating extension/retraction effect
            const pulsePhase = (this.time * 3 + i * 0.8) % (Math.PI * 2);
            const extensionFactor = 0.3 + 0.4 * Math.sin(pulsePhase); // Pulsate between 60% and 100%
            
            // Calculate tendril direction and length
            const baseAngle = (i / tendrilCount) * Math.PI * 2 + this.time * 0.5; // Slow rotation
            const tendrilLength = radius * (1.5 + 1.0 * intensity) * extensionFactor;
            
            // Create jagged tendril path
            const segments = 6 + Math.floor(4 * intensity);
            const tendrilPath = this.generateRadiantTendrilPath(
                centerX, centerY, radius, baseAngle, tendrilLength, segments, i
            );
            
            // Draw tendril with intensity-based brightness
            const tendrilIntensity = 0.7 + 0.3 * Math.sin(pulsePhase + i * 0.5);
            this.drawRadiantTendril(tendrilPath, intensity * tendrilIntensity, extensionFactor);
        }
    }
    
    // Generate a radiant tendril path that radiates outward from core
    generateRadiantTendrilPath(centerX, centerY, coreRadius, angle, length, segments, seed) {
        const path = [];
        const rng = this.seededRandom(seed + Math.floor(this.time * 5));
        
        // Start from core edge (white-hot center)
        const startX = centerX + Math.cos(angle) * coreRadius * 0.9;
        const startY = centerY + Math.sin(angle) * coreRadius * 0.9;
        path.push({ x: startX, y: startY });
        
        const segmentLength = length/3 / segments;
        let currentX = startX;
        let currentY = startY;
        let currentAngle = angle;
        
        for (let i = 1; i <= segments; i++) {
            // Add organic deviation while maintaining outward direction
            const deviation = (rng() - 0.5) * Math.PI * 0.3 * (1 - i / segments); // Less deviation as we go outward
            currentAngle += deviation;
            
            // Calculate next point with slight curve
            const progress = i / segments;
            const stepLength = segmentLength * (0.8 + 0.4 * rng()) * (1.2 - 0.4 * progress); // Shorter segments as we extend
            
            currentX += Math.cos(currentAngle) * stepLength;
            currentY += Math.sin(currentAngle) * stepLength;
            
            path.push({ x: currentX, y: currentY, progress });
            
            // Gradually return to outward direction
            currentAngle = currentAngle * 0.7 + angle * 0.3;
        }
        
        return path;
    }
    
    // Draw a single radiant tendril with blue-to-white gradient
    drawRadiantTendril(path, intensity, extensionFactor) {
        if (path.length < 2) return;
        
        // Blue lightning gradient: intensely bright at core, fading outward
        const colors = ['#87CEEB', '#4169E1', '#1E3A8A']; // Sky blue to deep blue
        const lineWidths = [2, 1.5, 1]; // Always thin
        const blurLevels = [12, 8, 4];
        
        // Draw multiple layers for radiant glow effect
        for (let layer = 0; layer < colors.length; layer++) {
            this.ctx.strokeStyle = colors[layer];
            this.ctx.lineWidth = lineWidths[layer];
            this.ctx.shadowBlur = blurLevels[layer] * intensity;
            this.ctx.shadowColor = colors[layer];
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            
            // Create gradient opacity: bright at core, fading outward
            for (let i = 0; i < path.length - 1; i++) {
                const progress = path[i + 1].progress || (i + 1) / (path.length - 1);
                const fadeOpacity = Math.max(0.1, 1.0 - progress * 0.8); // Fade but don't disappear completely
                this.ctx.globalAlpha = intensity * fadeOpacity * extensionFactor;
                
                this.ctx.beginPath();
                this.ctx.moveTo(path[i].x, path[i].y);
                this.ctx.lineTo(path[i + 1].x, path[i + 1].y);
                this.ctx.stroke();
            }
        }
        
        // Add bright white core section for "white-hot" effect
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 6 * intensity;
        this.ctx.shadowColor = '#FFFFFF';
        this.ctx.globalAlpha = intensity * extensionFactor;
        
        // Only draw first 30% of path in white (core section)
        const coreSegments = Math.floor(path.length * 0.3);
        if (coreSegments > 1) {
            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < coreSegments; i++) {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
            this.ctx.stroke();
        }
    }
    
    // Draw orbital lightning arcs that gravitate around the energy sphere
    drawOrbitalLightningArcs(centerX, centerY, radius, intensity, chargingProgress) {
        const arcCount = Math.floor(4 + 3 * intensity); // 4 to 7 orbital arcs
        
        for (let i = 0; i < arcCount; i++) {
            // Create orbital motion parameters
            const orbitRadius = radius * (1.2 + 0.6 * i / arcCount); // Different orbital distances
            const orbitSpeed = 1.0 + i * 0.3; // Different orbital speeds
            const arcPhase = this.time * orbitSpeed + i * Math.PI / 2;
            
            // Calculate arc properties
            const arcStartAngle = arcPhase;
            const arcLength = Math.PI * (0.3 + 0.4 * intensity); // Arc spans 54° to 126°
            const arcEndAngle = arcStartAngle + arcLength;
            
            // Create chaotic yet mesmerizing flow
            const chaos = Math.sin(this.time * 2 + i) * 0.2; // Orbital perturbation
            const currentOrbitRadius = orbitRadius + radius * 0.2 * chaos;
            
            // Generate orbital arc path
            const arcPath = this.generateOrbitalArcPath(
                centerX, centerY, currentOrbitRadius, arcStartAngle, arcEndAngle, i
            );
            
            // Draw with gravitational flow effect
            const flowIntensity = 0.6 + 0.4 * Math.abs(Math.sin(this.time * 3 + i));
            this.drawOrbitalArc(arcPath, intensity * flowIntensity, i);
        }
    }
    
    // Generate orbital arc path around the energy sphere
    generateOrbitalArcPath(centerX, centerY, orbitRadius, startAngle, endAngle, seed) {
        const path = [];
        const segments = 12; // Smooth orbital curve
        const rng = this.seededRandom(seed + Math.floor(this.time * 3));
        
        for (let i = 0; i <= segments; i++) {
            const progress = i / segments;
            const angle = startAngle + (endAngle - startAngle) * progress;
            
            // Add subtle orbital variations for "unstable energy field" effect
            const radiusVariation = 0.5 + (rng() - 0.5) * 0.1; // ±5% radius variation
            const currentRadius = orbitRadius * radiusVariation;
            
            const x = centerX + Math.cos(angle) * currentRadius;
            const y = centerY + Math.sin(angle) * currentRadius;
            
            path.push({ x, y, progress });
        }
        
        return path;
    }
    
    // Draw orbital arc with blue lightning effect
    drawOrbitalArc(path, intensity, arcIndex) {
        if (path.length < 2) return;
        
        // Orbital arc colors - blue lightning with dynamic intensity
        const baseColor = '#4169E1'; // Steel blue
        const glowColor = '#87CEEB'; // Sky blue
        
        // Draw outer glow
        this.ctx.strokeStyle = glowColor;
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 10 * intensity;
        this.ctx.shadowColor = glowColor;
        this.ctx.lineCap = 'round';
        this.ctx.globalAlpha = 0.6 * intensity;
        
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        this.ctx.stroke();
        
        // Draw inner core
        this.ctx.strokeStyle = baseColor;
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 5 * intensity;
        this.ctx.shadowColor = baseColor;
        this.ctx.globalAlpha = 0.8 * intensity;
        
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        this.ctx.stroke();
    }
    
    // Draw pulsating energy field lightning for unstable energy effect
    drawPulsatingEnergyField(centerX, centerY, radius, intensity, chargingProgress) {
        if (intensity < 0.3) return; // Only at higher charge levels
        
        const fieldRadius = radius * (1.5 + 0.5 * intensity);
        const pulsePhase = this.time * 4; // Fast pulsation
        const pulseIntensity = 0.5 + 0.5 * Math.abs(Math.sin(pulsePhase));
        
        // Create irregular energy field boundary
        const fieldPoints = 16;
        const fieldPath = [];
        
        for (let i = 0; i < fieldPoints; i++) {
            const angle = (i / fieldPoints) * Math.PI * 2;
            const radiusVariation = 1.0 + 0.3 * Math.sin(this.time * 3 + angle * 3) * pulseIntensity;
            const currentRadius = fieldRadius * radiusVariation;
            
            const x = centerX + Math.cos(angle) * currentRadius;
            const y = centerY + Math.sin(angle) * currentRadius;
            fieldPath.push({ x, y });
        }
        
        // Draw pulsating field boundary with lightning effect
        this.ctx.strokeStyle = '#1E90FF'; // Dodger blue
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 8 * intensity * pulseIntensity;
        this.ctx.shadowColor = '#1E90FF';
        this.ctx.globalAlpha = 0.4 * intensity * pulseIntensity;
        this.ctx.setLineDash([3, 2]); // Dashed for energy field effect
        
        this.ctx.beginPath();
        this.ctx.moveTo(fieldPath[0].x, fieldPath[0].y);
        for (let i = 1; i < fieldPath.length; i++) {
            this.ctx.lineTo(fieldPath[i].x, fieldPath[i].y);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        this.ctx.setLineDash([]); // Reset line dash
    }
}

// Auto‑patch: Energy sphere now disappears instantly when firing starts.
