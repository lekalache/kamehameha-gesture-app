// Kamehameha gesture detection logic
export class KamehamehaDetector {
  constructor() {
    this.gestureState = "idle"; // idle, positioning, charging, firing
    this.stateStartTime = 0;
    this.chargingDuration = 0;
    this.minimumChargingTime = 5000; // 5 seconds minimum charging for Kamehameha
    this.maxChargingTime = 20000; // 20 seconds maximum charging for max power
    this.maxFiringDuration = 15000; // 15 seconds max firing duration at full charge
    this.positioningFrameCount = 0;
    this.firingFrameCount = 0;
    this.firingStartTime = 0;
    this.allowedFiringDuration = 0; // Calculated based on charging time
    this.gestureHistory = [];
    this.onGestureChange = null; // Callback for gesture state changes
    this.debugMode = true; // Simplified detection for testing

    // Hand position tracking for direction detection
    this.handPositionHistory = [];
    this.maxHistoryLength = 10; // Keep last 10 positions
    this.chargingPosition = null; // Store position during charging
    
    // Logging throttling properties
    this.previousScore = 0;
    this.previousFiringScore = 0;
    this.lastLoggedProgress = -1;
    this.lastLoggedAngle = null;
    
    // Firing stability to prevent rapid state changes
    this.firingStabilityCounter = 0;
    this.firingStabilityThreshold = 5; // Require 5 consecutive invalid frames before ending firing
    
    // Default beam data (flat horizontal right, no depth)
    this.beamDirection = {
      angle: 0,                                     // 2‑D yaw
      vector: { x: 1, y: 0 },                       // 2‑D unit vector
      vector3D: { x: 1, y: 0, z: 0 },               // full 3‑D normal
      origin3D: { x: 0, y: 0, z: 0 },               // beam spawn point
      perspective: 1                                // depth gain factor
    };
    
    // Store reference to current hands for helper methods
    this.currentHands = null;
  }

  // Track hand positions for direction detection
  updateHandPositionHistory(hands) {
    if (!hands || hands.length !== 2) return;

    const [leftHand, rightHand] = this.identifyHands(hands);
    if (!leftHand || !rightHand) return;

    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");

    if (!leftWrist || !rightWrist) return;

    // Calculate center point between hands
    const centerX = (leftWrist.x + rightWrist.x) / 2;
    const centerY = (leftWrist.y + rightWrist.y) / 2;

    // Add to history
    this.handPositionHistory.push({
      x: centerX,
      y: centerY,
      timestamp: Date.now(),
      leftWrist: { x: leftWrist.x, y: leftWrist.y },
      rightWrist: { x: rightWrist.x, y: rightWrist.y },
      distance: Math.sqrt(
        Math.pow(leftWrist.x - rightWrist.x, 2) +
          Math.pow(leftWrist.y - rightWrist.y, 2)
      ),
    });

    // Keep only recent history
    if (this.handPositionHistory.length > this.maxHistoryLength) {
      this.handPositionHistory.shift();
    }
  }

  // Calculate thrust direction using V-bisector method with X-axis mirroring support and extra logging
  calculateThrustDirection(hands) {
    if (!hands || hands.length !== 2) {
      return { angle: 0, vector: { x: 1, y: 0 }, origin: { x: 0, y: 0 }, endpoint: { x: 1000, y: 0 }, method: "default" };
    }
    const [leftHand, rightHand] = this.identifyHands(hands);

    // Get keypoints
    const leftWrist = leftHand.keypoints.find(kp => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find(kp => kp.name === "wrist");
    const leftMiddle = leftHand.keypoints.find(kp => kp.name === "middle_finger_tip");
    const rightMiddle = rightHand.keypoints.find(kp => kp.name === "middle_finger_tip");

    if (!leftWrist || !rightWrist || !leftMiddle || !rightMiddle) {
      return { angle: 0, vector: { x: 1, y: 0 }, origin: { x: 0, y: 0 }, endpoint: { x: 1000, y: 0 }, method: "default" };
    }

    // === MIRROR SUPPORT FOR WEBCAM FEED ===
    // Set flipX to true if your webcam feed is mirrored (left hand appears on right)
    const flipX = true; // Try toggling this to false if needed
    const videoWidth = 640; // Adjust this to your actual video/canvas width

    function mirrorX(x) {
      return flipX ? (videoWidth - x) : x;
    }

    // MIRROR X if necessary
    const leftWristX = mirrorX(leftWrist.x), rightWristX = mirrorX(rightWrist.x);
    const leftMiddleX = mirrorX(leftMiddle.x), rightMiddleX = mirrorX(rightMiddle.x);

    // V-origin
    const origin = {
      x: (leftWristX + rightWristX) / 2,
      y: (leftWrist.y + rightWrist.y) / 2
    };

    // Target (midpoint of finger tips)
    const target = {
      x: (leftMiddleX + rightMiddleX) / 2,
      y: (leftMiddle.y + rightMiddle.y) / 2
    };

    // Direction: from V-origin to finger tip midpoint
    const vec = { x: target.x - origin.x, y: target.y - origin.y };
    const norm = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    const beamVec = norm === 0 ? { x: 0, y: -1 } : { x: vec.x / norm, y: vec.y / norm };

    // Debug log
    console.log(`🎯 New Beam from (${origin.x.toFixed(1)}, ${origin.y.toFixed(1)}) to (${target.x.toFixed(1)}, ${target.y.toFixed(1)}) vec=(${beamVec.x.toFixed(2)}, ${beamVec.y.toFixed(2)})`);

    // Use for your endpoint calculation:
    const beamLength = 1000;
    const endpoint = {
      x: origin.x + beamVec.x * beamLength,
      y: origin.y + beamVec.y * beamLength
    };

    return {
      angle: Math.atan2(beamVec.y, beamVec.x),
      vector: beamVec,
      origin,
      endpoint,
      method: "origin-to-midpoint"
    };
  }

  /* ────────────────────────── 3‑D helpers ────────────────────────── */


  // Convert screen-space (y-down) to math space (y-up) for 2D calculations
  // Note: This handles coordinate system conversion for 2D keypoints
  screenToCanvas2D(v) {
    return { x: v.x, y: -v.y };
  }

  // Get keypoint in consistent coordinate system
  // Prefer 3D coordinates when available, fallback to converted 2D
  getConsistentKeypoint(hand, keypointName) {
    // Try 3D first (already in world space)
    if (hand.keypoints3D) {
      const kp3D = hand.keypoints3D.find(kp => kp.name === keypointName);
      if (kp3D) return { x: kp3D.x, y: kp3D.y, z: kp3D.z || 0 };
    }
    
    // Fallback to 2D with coordinate conversion
    const kp2D = hand.keypoints.find(kp => kp.name === keypointName);
    if (kp2D) {
      const converted = this.screenToCanvas2D(kp2D);
      return { x: converted.x, y: converted.y, z: 0 };
    }
    
    return null;
  }

  // Check if hands are in starting position (Kamehameha charging pose with specific wrist configuration)
  isInStartingPosition(hands) {
    if (!hands || hands.length !== 2) {
      return false;
    }

    const [leftHand, rightHand] = this.identifyHands(hands);
    if (!leftHand || !rightHand) {
      return false;
    }

    // Get essential keypoints for charging pose analysis
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftThumb = leftHand.keypoints.find((kp) => kp.name === "thumb_tip");
    const rightThumb = rightHand.keypoints.find(
      (kp) => kp.name === "thumb_tip"
    );
    const leftIndex = leftHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const rightIndex = rightHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );

    if (
      !leftWrist ||
      !rightWrist ||
      !leftThumb ||
      !rightThumb ||
      !leftIndex ||
      !rightIndex
    ) {
      console.log(
        "🔍 Kamehameha Detection: Missing required keypoints for charging pose analysis"
      );
      return false;
    }

    // Analyze Dragon Ball Z charging pose using sophisticated criteria
    const chargingAnalysis = this.analyzeChargingPose(leftHand, rightHand);

    // Only log significant events, not every frame analysis
    if (!this.previousScore) this.previousScore = 0;
    
    if (chargingAnalysis.score < 2 && this.previousScore >= 2) {
      console.log(`❌ POSE VALIDATION LOST - Score ${chargingAnalysis.score}/6 too low (need ≥2)`);
    } else if (chargingAnalysis.score >= 2 && this.previousScore < 2) {
      console.log(`✅ POSE VALIDATED - Score ${chargingAnalysis.score}/6 ≥ 2, ready for thrust detection`);
    }
    
    this.previousScore = chargingAnalysis.score;
    const isValidPosition = chargingAnalysis.score >= 2;

    if (isValidPosition) {
      // Calculate beam direction from charging pose, but don't lock it in
      // We'll recalculate during the firing phase for more dynamic control
      const beamDirection = this.calculateBeamDirectionFromWrists(
        leftWrist,
        rightWrist,
        leftHand,
        rightHand
      );
    }

    return isValidPosition;
  }

  // Calculate energy sphere center based on finger positions within cupped hands
  calculateEnergySphereCenter(leftHand, rightHand) {
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftIndex = leftHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const rightIndex = rightHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const leftMiddle = leftHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );
    const rightMiddle = rightHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );

    if (
      !leftWrist ||
      !rightWrist ||
      !leftIndex ||
      !rightIndex ||
      !leftMiddle ||
      !rightMiddle
    ) {
      // Fallback to wrist center if finger positions unavailable
      return {
        x: (leftWrist.x + rightWrist.x) / 2,
        y: (leftWrist.y + rightWrist.y) / 2,
      };
    }

    // Calculate average finger tip positions for more accurate sphere positioning
    const leftFingerCenter = {
      x: (leftIndex.x + leftMiddle.x) / 2,
      y: (leftIndex.y + leftMiddle.y) / 2,
    };

    const rightFingerCenter = {
      x: (rightIndex.x + rightMiddle.x) / 2,
      y: (rightIndex.y + rightMiddle.y) / 2,
    };

    // Position sphere center between finger tips (within cupped hands)
    // This places the energy sphere where the palms are cupping, not at wrist level
    const sphereCenter = {
      x: (leftFingerCenter.x + rightFingerCenter.x) / 2,
      y: (leftFingerCenter.y + rightFingerCenter.y) / 2,
    };

    // Adjust sphere position slightly forward from fingers toward palm center
    const wristCenter = {
      x: (leftWrist.x + rightWrist.x) / 2,
      y: (leftWrist.y + rightWrist.y) / 2,
    };

    // Move sphere 30% from finger tips toward wrist center for optimal palm positioning
    const adjustedSphereCenter = {
      x: sphereCenter.x + (wristCenter.x - sphereCenter.x) * 0.3,
      y: sphereCenter.y + (wristCenter.y - sphereCenter.y) * 0.3,
    };

    return adjustedSphereCenter;
  }

  // Analyze charging pose based on Dragon Ball Z specifications with enhanced wrist configuration
  analyzeChargingPose(leftHand, rightHand) {
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftThumb = leftHand.keypoints.find((kp) => kp.name === "thumb_tip");
    const rightThumb = rightHand.keypoints.find(
      (kp) => kp.name === "thumb_tip"
    );
    const leftIndex = leftHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const rightIndex = rightHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const leftMiddle = leftHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );
    const rightMiddle = rightHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );

    let score = 0;
    const details = [];

    // 1. Wrists close together but not touching (energy sphere formation distance: 30-120px)
    const wristDistance = Math.sqrt(
      Math.pow(leftWrist.x - rightWrist.x, 2) +
        Math.pow(leftWrist.y - rightWrist.y, 2)
    );
    const distanceValid = wristDistance >= 30 && wristDistance <= 120;
    if (distanceValid) {
      score++;
      details.push(
        `✅ Wrist distance: ${wristDistance.toFixed(
          1
        )}px (optimal for energy sphere)`
      );
    } else {
      details.push(
        `❌ Wrist distance: ${wristDistance.toFixed(
          1
        )}px (need 30-120px for energy sphere)`
      );
    }

    // 2. Dragon Ball Z Wrist V-Formation: Wrists angled inward creating precise V-shape
    const wristVector = {
      x: rightWrist.x - leftWrist.x,
      y: rightWrist.y - leftWrist.y,
    };
    const sphereCenter = this.calculateEnergySphereCenter(leftHand, rightHand);

    // Enhanced V-formation analysis - wrists should create angle pointing toward energy sphere
    const leftWristToCenter = {
      x: sphereCenter.x - leftWrist.x,
      y: sphereCenter.y - leftWrist.y,
    };
    const rightWristToCenter = {
      x: sphereCenter.x - rightWrist.x,
      y: sphereCenter.y - rightWrist.y,
    };

    // Calculate V-formation angle (angle between wrist-to-center vectors)
    const leftWristAngle = Math.atan2(leftWristToCenter.y, leftWristToCenter.x);
    const rightWristAngle = Math.atan2(
      rightWristToCenter.y,
      rightWristToCenter.x
    );
    const vFormationAngle =
      (Math.abs(leftWristAngle - rightWristAngle) * 180) / Math.PI;

    // Dragon Ball Z V-formation: 120-180° angle between wrist orientations
    const vFormationValid = vFormationAngle >= 120 && vFormationAngle <= 180;
    if (vFormationValid) {
      score++;
      details.push(
        `✅ Dragon Ball Z V-formation: ${vFormationAngle.toFixed(
          1
        )}° (wrists angled perfectly)`
      );
    } else {
      details.push(
        `❌ V-formation angle: ${vFormationAngle.toFixed(
          1
        )}° (need 120-180° for Dragon Ball Z pose)`
      );
    }

    // 3. Enhanced Palm Orientation: Palms facing energy sphere with inner wrist visibility
    // Dragon Ball Z specification: Palms face the energy sphere, inner wrists partially visible
    const leftPalmVector = {
      x: leftIndex.x - leftWrist.x,
      y: leftIndex.y - leftWrist.y,
    };
    const rightPalmVector = {
      x: rightIndex.x - rightWrist.x,
      y: rightIndex.y - rightWrist.y,
    };

    // Check if palm vectors point toward sphere center
    const leftPalmAngle = Math.atan2(leftPalmVector.y, leftPalmVector.x);
    const rightPalmAngle = Math.atan2(rightPalmVector.y, rightPalmVector.x);
    const leftToSphereAngle = Math.atan2(
      leftWristToCenter.y,
      leftWristToCenter.x
    );
    const rightToSphereAngle = Math.atan2(
      rightWristToCenter.y,
      rightWristToCenter.x
    );

    const leftPalmAlignment =
      (Math.abs(leftPalmAngle - leftToSphereAngle) * 180) / Math.PI;
    const rightPalmAlignment =
      (Math.abs(rightPalmAngle - rightToSphereAngle) * 180) / Math.PI;

    // Palms should be oriented within 45° of pointing toward sphere center
    const palmsValid = leftPalmAlignment < 45 && rightPalmAlignment < 45;
    if (palmsValid) {
      score++;
      details.push(
        `✅ Palm orientation: Left ${leftPalmAlignment.toFixed(
          1
        )}°, Right ${rightPalmAlignment.toFixed(1)}° (facing energy sphere)`
      );
    } else {
      details.push(
        `❌ Palm orientation: Left ${leftPalmAlignment.toFixed(
          1
        )}°, Right ${rightPalmAlignment.toFixed(1)}° (not facing sphere)`
      );
    }

    // 4. Enhanced Wrist Rotation: Outward rotation with inner wrist visibility (Dragon Ball Z style)
    // Dragon Ball Z: Wrists rotated outward so inner side is partially visible
    const leftWristRotation = Math.atan2(
      leftThumb.y - leftWrist.y,
      leftThumb.x - leftWrist.x
    );
    const rightWristRotation = Math.atan2(
      rightThumb.y - rightWrist.y,
      rightThumb.x - rightWrist.x
    );

    const leftRotationDeg = (leftWristRotation * 180) / Math.PI;
    const rightRotationDeg = (rightWristRotation * 180) / Math.PI;

    // Enhanced rotation criteria for Dragon Ball Z outward wrist rotation
    // Left wrist: thumb should point upward-left (90° to 150°)
    // Right wrist: thumb should point upward-right (30° to 90°)
    const leftWristValid = leftRotationDeg >= 90 && leftRotationDeg <= 150;
    const rightWristValid = rightRotationDeg >= 30 && rightRotationDeg <= 90;
    const wristRotationValid = leftWristValid && rightWristValid;

    if (wristRotationValid) {
      score++;
      details.push(
        `✅ Dragon Ball Z wrist rotation: Left ${leftRotationDeg.toFixed(
          1
        )}°, Right ${rightRotationDeg.toFixed(1)}° (outward rotation)`
      );
    } else {
      details.push(
        `❌ Wrist rotation: Left ${leftRotationDeg.toFixed(
          1
        )}°, Right ${rightRotationDeg.toFixed(1)}° (need outward rotation)`
      );
    }

    // 5. Enhanced Finger Configuration: Wide aggressive spread with Dragon Ball Z intensity
    const leftFingerSpread = this.calculateEnhancedFingerSpread(leftHand);
    const rightFingerSpread = this.calculateEnhancedFingerSpread(rightHand);
    const avgFingerSpread =
      (leftFingerSpread.totalSpread + rightFingerSpread.totalSpread) / 2;
    const fingerIntensity =
      (leftFingerSpread.intensity + rightFingerSpread.intensity) / 2;

    // Dragon Ball Z charging: Wide finger spread (>100px) with high intensity (aggressive arch)
    const fingersSpreadValid = avgFingerSpread > 100 && fingerIntensity > 0.7;
    if (fingersSpreadValid) {
      score++;
      details.push(
        `✅ Dragon Ball Z finger spread: ${avgFingerSpread.toFixed(
          1
        )}px intensity ${fingerIntensity.toFixed(2)} (aggressive charging)`
      );
    } else {
      details.push(
        `❌ Finger spread: ${avgFingerSpread.toFixed(
          1
        )}px intensity ${fingerIntensity.toFixed(
          2
        )} (need wide aggressive spread)`
      );
    }

    // 6. Enhanced Energy Funnel: Precise convergence with Dragon Ball Z funnel dynamics
    // Dragon Ball Z: Hands and fingers create energy funnel directing power toward sphere
    const leftFingerDirection = {
      x: leftIndex.x - leftWrist.x,
      y: leftIndex.y - leftWrist.y,
    };
    const rightFingerDirection = {
      x: rightIndex.x - rightWrist.x,
      y: rightIndex.y - rightWrist.y,
    };

    // Calculate convergence precision
    const leftFingerAngle = Math.atan2(
      leftFingerDirection.y,
      leftFingerDirection.x
    );
    const rightFingerAngle = Math.atan2(
      rightFingerDirection.y,
      rightFingerDirection.x
    );
    const convergenceAngle = Math.abs(leftFingerAngle - rightFingerAngle);
    const convergenceDegrees = (convergenceAngle * 180) / Math.PI;

    // Enhanced funnel analysis: check if fingers create proper energy channel
    const funnelAlignment = this.analyzeDragonBallZEnergyFunnel(
      leftHand,
      rightHand,
      sphereCenter
    );
    const energyFunnelValid = funnelAlignment.isValid;

    if (energyFunnelValid) {
      score++;
      details.push(
        `✅ Dragon Ball Z energy funnel: ${convergenceDegrees.toFixed(
          1
        )}° convergence (${funnelAlignment.quality})`
      );
    } else {
      details.push(
        `❌ Energy funnel: ${convergenceDegrees.toFixed(1)}° convergence (${
          funnelAlignment.reason
        })`
      );
    }

    return {
      score,
      details,
      wristDistance,
      distanceValid,
      vFormationAngle,
      vFormationValid,
      palmsValid,
      wristRotationValid,
      fingersSpreadValid,
      energyFunnelValid,
      leftRotationDeg,
      rightRotationDeg,
      avgFingerSpread,
      fingerIntensity,
      convergenceAngle: convergenceDegrees,
      funnelQuality: energyFunnelValid ? funnelAlignment.quality : "poor",
    };
  }

  // Enhanced finger spread calculation with Dragon Ball Z intensity analysis
  calculateEnhancedFingerSpread(hand) {
    const thumb = hand.keypoints.find((kp) => kp.name === "thumb_tip");
    const index = hand.keypoints.find((kp) => kp.name === "index_finger_tip");
    const middle = hand.keypoints.find((kp) => kp.name === "middle_finger_tip");
    const ring = hand.keypoints.find((kp) => kp.name === "ring_finger_tip");
    const pinky = hand.keypoints.find((kp) => kp.name === "pinky_tip");
    const wrist = hand.keypoints.find((kp) => kp.name === "wrist");

    if (!thumb || !index || !middle || !ring || !pinky || !wrist) {
      return { totalSpread: 0, intensity: 0, fingerArch: 0 };
    }

    // Calculate distances between adjacent fingers (total spread)
    const thumbToIndex = Math.sqrt(
      Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2)
    );
    const indexToMiddle = Math.sqrt(
      Math.pow(index.x - middle.x, 2) + Math.pow(index.y - middle.y, 2)
    );
    const middleToRing = Math.sqrt(
      Math.pow(middle.x - ring.x, 2) + Math.pow(middle.y - ring.y, 2)
    );
    const ringToPinky = Math.sqrt(
      Math.pow(ring.x - pinky.x, 2) + Math.pow(ring.y - pinky.y, 2)
    );
    const totalSpread =
      thumbToIndex + indexToMiddle + middleToRing + ringToPinky;

    // Calculate finger extension intensity (how far fingers extend from wrist)
    const fingerDistances = [
      Math.sqrt(
        Math.pow(thumb.x - wrist.x, 2) + Math.pow(thumb.y - wrist.y, 2)
      ),
      Math.sqrt(
        Math.pow(index.x - wrist.x, 2) + Math.pow(index.y - wrist.y, 2)
      ),
      Math.sqrt(
        Math.pow(middle.x - wrist.x, 2) + Math.pow(middle.y - wrist.y, 2)
      ),
      Math.sqrt(Math.pow(ring.x - wrist.x, 2) + Math.pow(ring.y - wrist.y, 2)),
      Math.sqrt(
        Math.pow(pinky.x - wrist.x, 2) + Math.pow(pinky.y - wrist.y, 2)
      ),
    ];

    const avgFingerExtension =
      fingerDistances.reduce((sum, dist) => sum + dist, 0) /
      fingerDistances.length;
    const maxFingerExtension = Math.max(...fingerDistances);

    // Intensity score (0-1): measures how aggressively fingers are extended and spread
    const spreadIntensity = Math.min(totalSpread / 150, 1); // Normalize to 150px max spread
    const extensionIntensity = Math.min(avgFingerExtension / 80, 1); // Normalize to 80px avg extension
    const intensity = (spreadIntensity + extensionIntensity) / 2;

    // Calculate finger arch (curvature) for Dragon Ball Z aggressive pose
    const fingerArch = this.calculateFingerArch(hand);

    return {
      totalSpread,
      intensity,
      fingerArch,
      avgExtension: avgFingerExtension,
      maxExtension: maxFingerExtension,
    };
  }

  // Calculate finger arch/curvature for aggressive Dragon Ball Z charging pose
  calculateFingerArch(hand) {
    const fingers = ["index_finger", "middle_finger", "ring_finger", "pinky"];
    let totalArch = 0;
    let validFingers = 0;

    fingers.forEach((fingerBase) => {
      const tip = hand.keypoints.find((kp) => kp.name === `${fingerBase}_tip`);
      const pip = hand.keypoints.find((kp) => kp.name === `${fingerBase}_pip`);
      const mcp = hand.keypoints.find((kp) => kp.name === `${fingerBase}_mcp`);

      if (tip && pip && mcp) {
        // Calculate the arch by measuring the deviation from straight line
        const straightLineDistance = Math.sqrt(
          Math.pow(tip.x - mcp.x, 2) + Math.pow(tip.y - mcp.y, 2)
        );
        const pipToLine = this.distancePointToLine(pip, mcp, tip);
        const archRatio = pipToLine / straightLineDistance;
        totalArch += archRatio;
        validFingers++;
      }
    });

    return validFingers > 0 ? totalArch / validFingers : 0;
  }

  // Calculate distance from point to line (for finger arch calculation)
  distancePointToLine(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;
    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Analyze Dragon Ball Z energy funnel dynamics
  analyzeDragonBallZEnergyFunnel(leftHand, rightHand, sphereCenter) {
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftIndex = leftHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const rightIndex = rightHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const leftMiddle = leftHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );
    const rightMiddle = rightHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );

    if (
      !leftWrist ||
      !rightWrist ||
      !leftIndex ||
      !rightIndex ||
      !leftMiddle ||
      !rightMiddle
    ) {
      return { isValid: false, quality: "poor", reason: "missing keypoints" };
    }

    // 1. Check finger convergence toward energy sphere
    const leftFingerToSphere = {
      index: Math.sqrt(
        Math.pow(leftIndex.x - sphereCenter.x, 2) +
          Math.pow(leftIndex.y - sphereCenter.y, 2)
      ),
      middle: Math.sqrt(
        Math.pow(leftMiddle.x - sphereCenter.x, 2) +
          Math.pow(leftMiddle.y - sphereCenter.y, 2)
      ),
    };

    const rightFingerToSphere = {
      index: Math.sqrt(
        Math.pow(rightIndex.x - sphereCenter.x, 2) +
          Math.pow(rightIndex.y - sphereCenter.y, 2)
      ),
      middle: Math.sqrt(
        Math.pow(rightMiddle.x - sphereCenter.x, 2) +
          Math.pow(rightMiddle.y - sphereCenter.y, 2)
      ),
    };

    // 2. Check if fingers form proper funnel (closer to sphere than wrists)
    const leftWristToSphere = Math.sqrt(
      Math.pow(leftWrist.x - sphereCenter.x, 2) +
        Math.pow(leftWrist.y - sphereCenter.y, 2)
    );
    const rightWristToSphere = Math.sqrt(
      Math.pow(rightWrist.x - sphereCenter.x, 2) +
        Math.pow(rightWrist.y - sphereCenter.y, 2)
    );

    const leftFunnelValid =
      leftFingerToSphere.index < leftWristToSphere * 1.2 &&
      leftFingerToSphere.middle < leftWristToSphere * 1.2;
    const rightFunnelValid =
      rightFingerToSphere.index < rightWristToSphere * 1.2 &&
      rightFingerToSphere.middle < rightWristToSphere * 1.2;

    // 3. Check convergence angle (fingers should point toward sphere)
    const leftFingerDirection = {
      x: leftIndex.x - leftWrist.x,
      y: leftIndex.y - leftWrist.y,
    };
    const rightFingerDirection = {
      x: rightIndex.x - rightWrist.x,
      y: rightIndex.y - rightWrist.y,
    };
    const leftToSphere = {
      x: sphereCenter.x - leftWrist.x,
      y: sphereCenter.y - leftWrist.y,
    };
    const rightToSphere = {
      x: sphereCenter.x - rightWrist.x,
      y: sphereCenter.y - rightWrist.y,
    };

    // Calculate angles between finger direction and sphere direction
    const leftFingerAngle = Math.atan2(
      leftFingerDirection.y,
      leftFingerDirection.x
    );
    const rightFingerAngle = Math.atan2(
      rightFingerDirection.y,
      rightFingerDirection.x
    );
    const leftSphereAngle = Math.atan2(leftToSphere.y, leftToSphere.x);
    const rightSphereAngle = Math.atan2(rightToSphere.y, rightToSphere.x);

    const leftConvergence =
      (Math.abs(leftFingerAngle - leftSphereAngle) * 180) / Math.PI;
    const rightConvergence =
      (Math.abs(rightFingerAngle - rightSphereAngle) * 180) / Math.PI;

    // 4. Overall funnel quality assessment
    const convergenceValid = leftConvergence < 45 && rightConvergence < 45;
    const funnelStrength =
      leftFunnelValid && rightFunnelValid && convergenceValid;

    let quality = "poor";
    let reason = "fingers not forming energy funnel";

    if (funnelStrength) {
      const avgConvergence = (leftConvergence + rightConvergence) / 2;
      if (avgConvergence < 20) {
        quality = "excellent";
        reason = "perfect energy funnel formation";
      } else if (avgConvergence < 35) {
        quality = "good";
        reason = "strong energy funnel";
      } else {
        quality = "fair";
        reason = "moderate energy funnel";
      }
    } else {
      if (!leftFunnelValid || !rightFunnelValid) {
        reason = "fingers not converging toward sphere";
      } else if (!convergenceValid) {
        reason = "finger direction not aligned with sphere";
      }
    }

    return {
      isValid: funnelStrength,
      quality,
      reason,
      leftConvergence,
      rightConvergence,
      avgConvergence: (leftConvergence + rightConvergence) / 2,
      funnelStrength,
    };
  }

  // Calculate beam direction from wrist positions (Dragon Ball Z method)
  calculateBeamDirectionFromWrists(
    leftWrist,
    rightWrist,
    leftHand = null,
    rightHand = null
  ) {
    // Validate input parameters
    if (!leftWrist || !rightWrist) {
      console.log('🎯 Error: Missing wrist keypoints for beam calculation');
      return {
        angle: 0,
        vector: { x: 1, y: 0 },
        origin: { x: 0, y: 0 },
        wristAxis: { x: 0, y: 0 },
        error: 'Missing wrist keypoints'
      };
    }

    // Calculate wrist axis vector
    const wristAxis = {
      x: rightWrist.x - leftWrist.x,
      y: rightWrist.y - leftWrist.y,
    };

    // Check for degenerate case (wrists too close together)
    const wristDistance = Math.sqrt(wristAxis.x * wristAxis.x + wristAxis.y * wristAxis.y);
    if (wristDistance < 10) {
      console.log('🎯 Warning: Wrists too close together for reliable beam direction');
      return {
        angle: 0,
        vector: { x: 1, y: 0 },
        origin: { x: (leftWrist.x + rightWrist.x) / 2, y: (leftWrist.y + rightWrist.y) / 2 },
        wristAxis: wristAxis,
        error: 'Wrists too close together'
      };
    }

    // Initialize beam direction
    let beamDirection = { x: 0, y: 0 };
    let directionMethod = "default";

    // PRIORITY 1: Use finger convergence direction if available (most accurate)
    if (leftHand && rightHand) {
      const fingerDirection = this.calculateFingerConvergenceDirection(leftHand, rightHand);
      if (fingerDirection) {
        beamDirection = fingerDirection;
        directionMethod = "finger_convergence";
        console.log('🎯 Using finger convergence direction for beam');
      }
    }

    // PRIORITY 2: If finger convergence failed, try palm facing direction
    if (directionMethod === "default" && leftHand && rightHand) {
      const palmDirection = this.calculatePalmFacingDirection(leftHand, rightHand);
      if (palmDirection) {
        beamDirection = palmDirection;
        directionMethod = "palm_facing";
        console.log('🎯 Using palm facing direction for beam');
      }
    }

    // PRIORITY 3: Fallback to perpendicular wrist direction
    if (directionMethod === "default") {
      // Calculate perpendicular vector (beam direction) using right-hand normal
      // First determine if we should use clockwise or counterclockwise rotation
      const wristAngle = Math.atan2(wristAxis.y, wristAxis.x);
      const isClockwise = Math.abs(wristAngle) < Math.PI / 2;
      
      // Calculate perpendicular vector based on wrist orientation
      beamDirection = {
        x: isClockwise ? -wristAxis.y : wristAxis.y,
        y: isClockwise ? wristAxis.x : -wristAxis.x
      };
      directionMethod = "perpendicular_wrist";
      console.log('🎯 Using perpendicular wrist direction for beam - Wrist angle:', (wristAngle * 180 / Math.PI).toFixed(1) + '°');
    }

    // Normalize the beam direction
    const magnitude = Math.sqrt(
      beamDirection.x * beamDirection.x + beamDirection.y * beamDirection.y
    );
    const normalizedBeamDirection =
      magnitude > 0
        ? {
            x: beamDirection.x / magnitude,
            y: beamDirection.y / magnitude,
          }
        : { x: 1, y: 0 }; // Default right direction

    // Calculate beam angle in radians
    const beamAngle = Math.atan2(
      normalizedBeamDirection.y,
      normalizedBeamDirection.x
    );

    // Calculate beam origin - use energy sphere center for more accurate beam origin
    let beamOrigin;
    if (leftHand && rightHand) {
      beamOrigin = this.calculateEnergySphereCenter(leftHand, rightHand);
    } else {
      // Fallback to wrist center if hand data not available
      beamOrigin = {
        x: (leftWrist.x + rightWrist.x) / 2,
        y: (leftWrist.y + rightWrist.y) / 2,
      };
    }

    // Return complete beam data
    return {
      angle: beamAngle,
      vector: normalizedBeamDirection,
      origin: beamOrigin,
      wristAxis: wristAxis,
      wristDistance: wristDistance,
      magnitude: magnitude,
      method: directionMethod
    };
  }

  // Calculate finger convergence direction - where all fingers are pointing
  calculateFingerConvergenceDirection(leftHand, rightHand) {
    // Validate input parameters
    if (!leftHand || !rightHand) {
      return null;
    }
    
    const leftWrist = this.getConsistentKeypoint(leftHand, "wrist");
    const rightWrist = this.getConsistentKeypoint(rightHand, "wrist");
    
    // Get finger tips using consistent coordinate system
    const leftMiddle = this.getConsistentKeypoint(leftHand, "middle_finger_tip");
    const rightMiddle = this.getConsistentKeypoint(rightHand, "middle_finger_tip");
    const leftIndex = this.getConsistentKeypoint(leftHand, "index_finger_tip");
    const rightIndex = this.getConsistentKeypoint(rightHand, "index_finger_tip");
    
    // Make sure we have the necessary keypoints
    if (!leftWrist || !rightWrist || !leftMiddle || !rightMiddle) {
      return null;
    }
    
    // Calculate direction vectors from wrists to fingers (primary: middle finger)
    const leftFingerDir = {
      x: leftMiddle.x - leftWrist.x,
      y: leftMiddle.y - leftWrist.y
    };
    
    const rightFingerDir = {
      x: rightMiddle.x - rightWrist.x,
      y: rightMiddle.y - rightWrist.y
    };
    
    // If we have index fingers, use both for better accuracy
    let avgLeftDir = leftFingerDir;
    let avgRightDir = rightFingerDir;
    
    if (leftIndex && rightIndex) {
      const leftIndexDir = {
        x: leftIndex.x - leftWrist.x,
        y: leftIndex.y - leftWrist.y
      };
      const rightIndexDir = {
        x: rightIndex.x - rightWrist.x,
        y: rightIndex.y - rightWrist.y
      };
      
      // Average middle and index finger directions
      avgLeftDir = {
        x: (leftFingerDir.x + leftIndexDir.x) / 2,
        y: (leftFingerDir.y + leftIndexDir.y) / 2
      };
      avgRightDir = {
        x: (rightFingerDir.x + rightIndexDir.x) / 2,
        y: (rightFingerDir.y + rightIndexDir.y) / 2
      };
    }
    
    // Calculate the beam direction as average of both hands
    const beamDirection = {
      x: (avgLeftDir.x + avgRightDir.x) / 2,
      y: (avgLeftDir.y + avgRightDir.y) / 2
    };
    
    // Normalize the direction vector
    const magnitude = Math.sqrt(beamDirection.x * beamDirection.x + beamDirection.y * beamDirection.y);

    if (magnitude < 10) { // Minimum threshold for meaningful direction
      return null;
    }

    const normalizedDirection = {
      x: beamDirection.x / magnitude,
      y: beamDirection.y / magnitude
    };
    
    // Calculate the angle of the direction vector
    const directionAngle = Math.atan2(normalizedDirection.y, normalizedDirection.x);
    
    // Ensure the beam points away from the body
    // In a typical Kamehameha pose, the beam should point forward (positive x)
    // If the angle is in the left half-plane (negative x), flip the direction
    if (Math.abs(directionAngle) > Math.PI / 2) {
      normalizedDirection.x = -normalizedDirection.x;
      normalizedDirection.y = -normalizedDirection.y;
    }
    
    console.log('🎯 Finger convergence direction:', 
      `(${normalizedDirection.x.toFixed(3)}, ${normalizedDirection.y.toFixed(3)})`,
      `angle: ${(directionAngle * 180 / Math.PI).toFixed(1)}°`
    );
    
    return normalizedDirection;
  }

  // Helper method to calculate palm-facing direction (alternative approach)
  calculatePalmFacingDirection(leftHand, rightHand) {
    // Validate input parameters
    if (!leftHand || !rightHand) {
      console.log('🎯 Error: Missing hand data for palm direction calculation');
      return null;
    }
    
    const leftWrist = leftHand.keypoints.find(kp => kp.name === 'wrist');
    const rightWrist = rightHand.keypoints.find(kp => kp.name === 'wrist');
    const leftMiddle = leftHand.keypoints.find(kp => kp.name === 'middle_finger_tip');
    const rightMiddle = rightHand.keypoints.find(kp => kp.name === 'middle_finger_tip');
    const leftIndex = leftHand.keypoints.find(kp => kp.name === 'index_finger_tip');
    const rightIndex = rightHand.keypoints.find(kp => kp.name === 'index_finger_tip');

    if (!leftWrist || !rightWrist || !leftMiddle || !rightMiddle) {
      console.log('🎯 Error: Missing keypoints for palm direction calculation');
      return null;
    }

    // Calculate palm direction vectors using both middle and index fingers for better accuracy
    let leftPalmDir, rightPalmDir;
    
    if (leftIndex && rightIndex) {
      // Use average of middle and index finger directions for more accurate palm orientation
      leftPalmDir = {
        x: ((leftMiddle.x + leftIndex.x) / 2) - leftWrist.x,
        y: ((leftMiddle.y + leftIndex.y) / 2) - leftWrist.y
      };
      rightPalmDir = {
        x: ((rightMiddle.x + rightIndex.x) / 2) - rightWrist.x,
        y: ((rightMiddle.y + rightIndex.y) / 2) - rightWrist.y
      };
    } else {
      // Fallback to just middle finger direction
      leftPalmDir = {
        x: leftMiddle.x - leftWrist.x,
        y: leftMiddle.y - leftWrist.y
      };
      rightPalmDir = {
        x: rightMiddle.x - rightWrist.x,
        y: rightMiddle.y - rightWrist.y
      };
    }

    // Average the two palm directions and NEGATE to point away from palms
    const avgPalmDir = {
      x: -((leftPalmDir.x + rightPalmDir.x) / 2),  // Negated to point away from palms
      y: -((leftPalmDir.y + rightPalmDir.y) / 2)   // Negated to point away from palms
    };

    // Normalize the direction vector
    const magnitude = Math.sqrt(avgPalmDir.x * avgPalmDir.x + avgPalmDir.y * avgPalmDir.y);
    
    if (magnitude === 0) {
      console.log('🎯 Warning: Zero magnitude in palm direction calculation');
      return null;
    }
    
    const normalizedDirection = {
      x: avgPalmDir.x / magnitude,
      y: avgPalmDir.y / magnitude
    };
    
    // Ensure the beam points away from the body
    // Check if the direction is pointing towards the body (negative x)
    if (normalizedDirection.x < 0) {
      normalizedDirection.x = -normalizedDirection.x;
      normalizedDirection.y = -normalizedDirection.y;
    }
    
    console.log(`🎯 Palm facing direction: (${normalizedDirection.x.toFixed(3)}, ${normalizedDirection.y.toFixed(3)})`);
    
    return normalizedDirection;
  }

  // Check if hands are in firing position (kamehameha_firing_pose using TensorFlow keypoints)
  isInFiringPosition(hands) {
    if (!hands || hands.length !== 2) {
      console.log("🚀 Kamehameha Firing Check: Need exactly 2 hands");
      return false;
    }

    const [leftHand, rightHand] = this.identifyHands(hands);
    if (!leftHand || !rightHand) {
      console.log("🚀 Kamehameha Firing Check: Could not identify hands");
      return false;
    }

    // Get required keypoints for kamehameha_firing_pose detection
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftThumb = leftHand.keypoints.find((kp) => kp.name === "thumb_tip");
    const rightThumb = rightHand.keypoints.find(
      (kp) => kp.name === "thumb_tip"
    );
    const leftIndex = leftHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const rightIndex = rightHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const leftMiddle = leftHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );
    const rightMiddle = rightHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );

    if (
      !leftWrist ||
      !rightWrist ||
      !leftThumb ||
      !rightThumb ||
      !leftIndex ||
      !rightIndex ||
      !leftMiddle ||
      !rightMiddle
    ) {
      console.log(
        "🚀 Kamehameha Firing Check: Missing required keypoints for pose analysis"
      );
      return false;
    }

    // Analyze kamehameha_firing_pose using 5-point scoring system (removed forward extension)
    let poseScore = 0;
    const scoreDetails = [];


    // 2. Fingers curved consistently around imaginary energy sphere
    const fingersCurved = this.checkFingersCurved(leftHand, rightHand);
    if (fingersCurved.isValid) {
      poseScore++;
      scoreDetails.push("✅ Fingers curved properly");
    } else {
      scoreDetails.push("❌ Fingers not curved properly");
    }

    // 3. Hands tightly aligned and symmetrical
    const handsAligned = this.checkHandsAligned(
      leftWrist,
      rightWrist,
      leftHand,
      rightHand
    );
    if (handsAligned.isValid) {
      poseScore++;
      scoreDetails.push("✅ Hands aligned symmetrically");
    } else {
      scoreDetails.push("❌ Hands not aligned");
    }

    // 4. Wrists slightly rotated inward
    const wristsRotated = this.checkWristsRotated(leftHand, rightHand);
    if (wristsRotated.isValid) {
      poseScore++;
      scoreDetails.push("✅ Wrists rotated inward");
    } else {
      scoreDetails.push("❌ Wrists not rotated inward");
    }

    // 5. Energy sphere formation (palms facing inward, fingers forming circle)
    const energySphere = this.checkEnergySphereFormation(leftHand, rightHand);
    if (energySphere.isValid) {
      poseScore++;
      scoreDetails.push("✅ Energy sphere formation detected");
    } else {
      scoreDetails.push("❌ Energy sphere formation not detected");
    }

    // More tolerant firing detection: require at least 2 out of 5 criteria (reduced from 3)
    // This makes firing more stable and less likely to end due to minor hand movements
    const isFiringPose = poseScore >= 2;

    // Only log significant state changes, not every frame
    if (!this.previousFiringScore) this.previousFiringScore = 0;
    
    if (isFiringPose && this.previousFiringScore < 2) {
      console.log(`🚀 FIRING POSE DETECTED! Score: ${poseScore}/5 (tolerant threshold)`);
    } else if (!isFiringPose && this.previousFiringScore >= 2) {
      console.log(`🚀 FIRING POSE LOST! Score: ${poseScore}/5 (below tolerant threshold)`);
    }
    
    this.previousFiringScore = poseScore;

    return isFiringPose;
  }

  // Check if fingers are curved around imaginary sphere (criterion 3)
  checkFingersCurved(leftHand, rightHand) {
    const leftFingers = [
      "index_finger_tip",
      "middle_finger_tip",
      "ring_finger_tip",
      "pinky_tip",
    ];
    const rightFingers = [
      "index_finger_tip",
      "middle_finger_tip",
      "ring_finger_tip",      "pinky_tip",
    ];

    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");

    if (!leftWrist || !rightWrist) {
      return { isValid: false, reason: "Missing wrist keypoints" };
    }

    // Calculate average finger curvature for each hand
    let leftCurvature = 0,
      rightCurvature = 0;
    let leftCount = 0,
      rightCount = 0;

    // Check left hand finger curvature
    leftFingers.forEach((fingerName) => {
      const finger = leftHand.keypoints.find((kp) => kp.name === fingerName);
      const fingerMcp = leftHand.keypoints.find(
        (kp) => kp.name === fingerName.replace("_tip", "_mcp")
      );
      if (finger && fingerMcp) {
        const curvature = Math.sqrt(
          Math.pow(finger.x - fingerMcp.x, 2) +
            Math.pow(finger.y - fingerMcp.y, 2)
        );
        leftCurvature += curvature;
        leftCount++;
      }
    });

    // Check right hand finger curvature
    rightFingers.forEach((fingerName) => {
      const finger = rightHand.keypoints.find((kp) => kp.name === fingerName);
      const fingerMcp = rightHand.keypoints.find(
        (kp) => kp.name === fingerName.replace("_tip", "_mcp")
      );
      if (finger && fingerMcp) {
        const curvature = Math.sqrt(
          Math.pow(finger.x - fingerMcp.x, 2) +
            Math.pow(finger.y - fingerMcp.y, 2)
        );
        rightCurvature += curvature;
        rightCount++;
      }
    });

    if (leftCount === 0 || rightCount === 0) {
      return { isValid: false, reason: "Insufficient finger keypoints" };
    }

    const avgLeftCurvature = leftCurvature / leftCount;
    const avgRightCurvature = rightCurvature / rightCount;
    const expectedCurvature = 40; // Expected curvature for energy sphere grip
    const tolerance = 20;

    const leftValid =
      Math.abs(avgLeftCurvature - expectedCurvature) < tolerance;
    const rightValid =
      Math.abs(avgRightCurvature - expectedCurvature) < tolerance;
    const isValid = leftValid && rightValid;

    return {
      isValid,
      avgLeftCurvature,
      avgRightCurvature,
      reason: isValid
        ? "Fingers properly curved"
        : "Finger curvature not matching energy sphere grip",
    };
  }

  // Check if hands are aligned and symmetrical (criterion 4)
  checkHandsAligned(leftWrist, rightWrist, leftHand, rightHand) {
    // Check horizontal alignment (similar y coordinates)
    const verticalAlignment = Math.abs(leftWrist.y - rightWrist.y);
    const maxVerticalOffset = 30; // 30px tolerance

    // Check if hands are at reasonable distance (not too close, not too far)
    const handDistance = Math.sqrt(
      Math.pow(leftWrist.x - rightWrist.x, 2) +
        Math.pow(leftWrist.y - rightWrist.y, 2)
    );
    const minDistance = 80;
    const maxDistance = 200;

    const isAligned =
      verticalAlignment < maxVerticalOffset &&
      handDistance > minDistance &&
      handDistance < maxDistance;

    return {
      isValid: isAligned,
      verticalAlignment,
      handDistance,
      reason: isAligned
        ? "Hands properly aligned"
        : "Hands not aligned or incorrect distance",
    };
  }

  // Check if wrists are rotated inward (criterion 5)
  checkWristsRotated(leftHand, rightHand) {
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftThumb = leftHand.keypoints.find((kp) => kp.name === "thumb_tip");
    const rightThumb = rightHand.keypoints.find(
      (kp) => kp.name === "thumb_tip"
    );

    if (!leftWrist || !rightWrist || !leftThumb || !rightThumb) {
      return { isValid: false, reason: "Missing keypoints for rotation check" };
    }

    // Calculate wrist rotation based on thumb position relative to wrist
    const leftRotation = Math.atan2(
      leftThumb.y - leftWrist.y,
      leftThumb.x - leftWrist.x
    );
    const rightRotation = Math.atan2(
      rightThumb.y - rightWrist.y,
      rightThumb.x - rightWrist.x
    );

    // For inward rotation, thumbs should be pointing somewhat toward each other
    const leftRotationDeg = (leftRotation * 180) / Math.PI;
    const rightRotationDeg = (rightRotation * 180) / Math.PI;

    // Check if rotations indicate inward orientation
    const leftInward = leftRotationDeg > -45 && leftRotationDeg < 45; // Pointing right-ish
    const rightInward = rightRotationDeg > 135 || rightRotationDeg < -135; // Pointing left-ish

    const isValid = leftInward && rightInward;

    return {
      isValid,
      leftRotationDeg,
      rightRotationDeg,
      reason: isValid
        ? "Wrists rotated inward properly"
        : "Wrist rotation not inward",
    };
  }

  // Check energy sphere formation (criterion 6)
  checkEnergySphereFormation(leftHand, rightHand) {
    const leftWrist = leftHand.keypoints.find((kp) => kp.name === "wrist");
    const rightWrist = rightHand.keypoints.find((kp) => kp.name === "wrist");
    const leftIndex = leftHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const rightIndex = rightHand.keypoints.find(
      (kp) => kp.name === "index_finger_tip"
    );
    const leftMiddle = leftHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );
    const rightMiddle = rightHand.keypoints.find(
      (kp) => kp.name === "middle_finger_tip"
    );

    if (
      !leftWrist ||
      !rightWrist ||
      !leftIndex ||
      !rightIndex ||
      !leftMiddle ||
      !rightMiddle
    ) {
      return {
        isValid: false,
        reason: "Missing keypoints for sphere formation check",
      };
    }

    // Use improved energy sphere center calculation (within cupped hands)
    const sphereCenter = this.calculateEnergySphereCenter(leftHand, rightHand);
    const centerX = sphereCenter.x;
    const centerY = sphereCenter.y;

    // Check if fingertips are forming a circular pattern around the center
    const leftIndexDist = Math.sqrt(
      Math.pow(leftIndex.x - centerX, 2) + Math.pow(leftIndex.y - centerY, 2)
    );
    const rightIndexDist = Math.sqrt(
      Math.pow(rightIndex.x - centerX, 2) + Math.pow(rightIndex.y - centerY, 2)
    );
    const leftMiddleDist = Math.sqrt(
      Math.pow(leftMiddle.x - centerX, 2) + Math.pow(leftMiddle.y - centerY, 2)
    );
    const rightMiddleDist = Math.sqrt(
      Math.pow(rightMiddle.x - centerX, 2) +
        Math.pow(rightMiddle.y - centerY, 2)
    );

    // Check if distances are similar (forming a sphere)
    const avgDistance =
      (leftIndexDist + rightIndexDist + leftMiddleDist + rightMiddleDist) / 4;
    const tolerance = 20;

    const distanceVariance = [
      Math.abs(leftIndexDist - avgDistance),
      Math.abs(rightIndexDist - avgDistance),
      Math.abs(leftMiddleDist - avgDistance),
      Math.abs(rightMiddleDist - avgDistance),
    ];

    const maxVariance = Math.max(...distanceVariance);
    const isValid =
      maxVariance < tolerance && avgDistance > 30 && avgDistance < 100;

    return {
      isValid,
      avgDistance,
      maxVariance,
      reason: isValid
        ? "Energy sphere formation detected"
        : "Fingertips not forming sphere pattern",
    };
  }

  // Identify which hand is left and which is right based on x position
  identifyHands(hands) {
    if (hands.length !== 2) return [null, null];

    const hand1 = hands[0];
    const hand2 = hands[1];

    const wrist1 = hand1.keypoints.find((kp) => kp.name === "wrist");
    const wrist2 = hand2.keypoints.find((kp) => kp.name === "wrist");

    if (!wrist1 || !wrist2) return [null, null];

    // Account for mirrored video feed: In mirrored view, left hand appears on right side
    // Use 3D coordinates if available for more accurate positioning
    let x1, x2;
    if (hand1.keypoints3D && hand2.keypoints3D) {
      const wrist3D1 = hand1.keypoints3D.find((kp) => kp.name === "wrist");
      const wrist3D2 = hand2.keypoints3D.find((kp) => kp.name === "wrist");
      if (wrist3D1 && wrist3D2) {
        // 3D coordinates are not mirrored, so left hand has smaller x in world space
        x1 = wrist3D1.x;
        x2 = wrist3D2.x;
      } else {
        // Fallback to 2D but account for mirroring
        x1 = wrist1.x;
        x2 = wrist2.x;
      }
    } else {
      // 2D coordinates in mirrored view
      x1 = wrist1.x;
      x2 = wrist2.x;
    }

    // In world space (3D) or corrected 2D space: left hand has smaller x
    if (x1 < x2) {
      return [hand1, hand2]; // [leftHand, rightHand]
    } else {
      return [hand2, hand1]; // [leftHand, rightHand]
    }
  }

  // Main detection function to be called on each frame
  detectGesture(hands) {
    // Store current hands reference for helper methods
    this.currentHands = hands;
    
    // If no hands detected, reset to idle state
    if (!hands || hands.length === 0) {
      this.currentHands = null; // Clear hands reference
      const previousState = this.gestureState;
      if (this.gestureState !== 'idle') {
        console.log(`🎯 STATE CHANGE: ${this.gestureState} → idle (no hands detected)`);
        this.gestureState = 'idle';
        this.positioningFrameCount = 0;
        this.firingFrameCount = 0;
        this.firingStabilityCounter = 0;
        this.chargingDuration = 0;
        
        // Call callback if state changed

        if (previousState !== this.gestureState && this.onGestureChange) {
          this.onGestureChange(this.gestureState, this.getGestureData());
        }
      }
      
      return this.getGestureData();
    }

    // Update hand position tracking
    this.updateHandPositionHistory(hands);

    const currentTime = Date.now();
    const previousState = this.gestureState;

    switch (this.gestureState) {
      case "idle":
        if (this.isInStartingPosition(hands)) {
          console.log("🎯 STATE CHANGE: idle → positioning");
          this.gestureState = "positioning";
          this.stateStartTime = currentTime;
          this.positioningFrameCount = 1;
        }
        break;

      case "positioning":
        if (this.isInStartingPosition(hands)) {
          this.positioningFrameCount++;
          // Only log progress at key milestones
          if (this.positioningFrameCount % 5 === 0 || this.positioningFrameCount >= 15) {
            console.log(
              `⏱️ POSITIONING: Frame ${this.positioningFrameCount}/15 (need 15 to advance)`
            );
          }
          // Need to hold position for at least 15 frames (~0.5 second at 30fps)
          if (this.positioningFrameCount >= 15) {
            console.log("🎯 STATE CHANGE: positioning → charging");
            this.gestureState = "charging";
            this.stateStartTime = currentTime;
            this.chargingDuration = 0;
            // Store the charging position for direction calculation
            if (this.handPositionHistory.length > 0) {
              this.chargingPosition = {
                ...this.handPositionHistory[
                  this.handPositionHistory.length - 1
                ],
              };
            }
          }
        } else {
          // Lost position, reset
          console.log("🎯 STATE CHANGE: positioning → idle (lost position)");
          this.gestureState = "idle";
          this.positioningFrameCount = 0;
        }
        break;

      case "charging":
        if (this.isInStartingPosition(hands)) {
          this.chargingDuration = currentTime - this.stateStartTime;
          const progressPercent = Math.round(
            (this.chargingDuration / this.maxChargingTime) * 100
          );
          
          // Only log charging progress every 25% or at key milestones
          if (progressPercent % 25 === 0 && progressPercent !== this.lastLoggedProgress) {
            console.log(
              `⚡ CHARGING: ${this.chargingDuration}ms (${progressPercent}%) - Min: ${this.minimumChargingTime}ms`
            );
            this.lastLoggedProgress = progressPercent;
          }

          // Allow charging for up to 5 seconds
          if (this.chargingDuration >= this.maxChargingTime) {
            console.log(
              "🎯 STATE CHANGE: charging → idle (max charge time reached)"
            );
            this.gestureState = "idle"; // Reset if charging too long
          }
        } else if (
          this.isInFiringPosition(hands) &&
          this.chargingDuration >= this.minimumChargingTime
        ) {
          // Calculate allowed firing duration based on charging time
          // Linear scaling: 5 seconds charging = 1.875 seconds firing, 20 seconds charging = 15 seconds firing
          const chargingRatio = Math.min(this.chargingDuration / this.maxChargingTime, 1.0);
          this.allowedFiringDuration = Math.max(
            1875, // Minimum 1.875 seconds firing (5s charge * 0.375)
            chargingRatio * this.maxFiringDuration
          );
          this.firingStartTime = currentTime;
          
          console.log(`🎯 STATE CHANGE: charging → firing (thrust detected!)`);
          console.log(`⚡ Charged for ${this.chargingDuration}ms, allowed firing: ${this.allowedFiringDuration}ms`);
          
          this.gestureState = "firing";
          this.stateStartTime = currentTime;
          this.firingFrameCount = 1;
          this.firingStabilityCounter = 0; // Reset stability counter when starting firing
          // Use 3D direction if possible
          this.beamDirection = this.calculateThrustDirection(hands);
        } else {
          // Lost position too early, reset
          console.log(
            `🎯 STATE CHANGE: charging → idle (lost position, charged: ${this.chargingDuration}ms)`
          );
          this.gestureState = "idle";
        }
        break;

      case "firing":
        if (this.isInFiringPosition(hands)) {
          // Valid firing position - reset stability counter and continue firing
          this.firingStabilityCounter = 0;
          this.firingFrameCount++;
          const currentFiringDuration = currentTime - this.firingStartTime;
          
          // Update beam direction every frame for smooth control
          const newDirection = this.calculateThrustDirection(hands);
          if (newDirection) {
            // Only log if direction changes significantly (more than 5 degrees)
            const angleDiff = Math.abs(newDirection.angle - this.lastBeamAngle);
            if (angleDiff > 5 * Math.PI / 180) {
              console.log(`🎯 Beam direction updated: ${(newDirection.angle * 180 / Math.PI).toFixed(1)}° (${newDirection.vector.x.toFixed(2)}, ${newDirection.vector.y.toFixed(2)})`);
              this.lastBeamAngle = newDirection.angle;
            }
            this.beamDirection = newDirection;
          }
          
          // Check if firing duration limit has been reached
          if (currentFiringDuration >= this.allowedFiringDuration) {
            console.log(`🎯 STATE CHANGE: firing → idle (firing duration limit reached: ${currentFiringDuration}ms/${this.allowedFiringDuration}ms)`);
            this.gestureState = "idle"; // End firing due to duration limit
          }
          // Also check minimum firing frames (at least 4 seconds at 30fps for longer firing duration)
          else if (this.firingFrameCount >= 120) {
            console.log("🎯 STATE CHANGE: firing → idle (minimum firing duration complete)");
            this.gestureState = "idle"; // Complete gesture
          }
        } else {
          // Invalid firing position - increment stability counter
          this.firingStabilityCounter++;
          console.log(`🎯 Firing pose lost temporarily (${this.firingStabilityCounter}/${this.firingStabilityThreshold})`);
          
          // Only end firing after consecutive invalid frames to prevent flickering
          if (this.firingStabilityCounter >= this.firingStabilityThreshold) {
            console.log("🎯 STATE CHANGE: firing → idle (firing motion ended - stability threshold reached)");
            this.gestureState = "idle";
          }
          // Continue firing during temporary pose loss
          this.firingFrameCount++;
        }
        break;
    }

    // Call callback if state changed
    if (previousState !== this.gestureState && this.onGestureChange) {
      console.log(
        `🔄 Gesture callback triggered: ${previousState} → ${this.gestureState}`
      );
      this.onGestureChange(this.gestureState, {
        chargingDuration: this.chargingDuration,
        chargingProgress: Math.min(
          this.chargingDuration / this.maxChargingTime,
          1.0
        ),
        firingFrameCount: this.firingFrameCount,
        allowedFiringDuration: this.allowedFiringDuration,
        currentFiringDuration: this.gestureState === "firing" ? (currentTime - this.firingStartTime) : 0,
      });
    }

    // Calculate energy sphere center if hands are available for charging state
    let energySphereCenter = null;
    if (hands && hands.length === 2 && this.gestureState === "charging") {
      const [leftHand, rightHand] = this.identifyHands(hands);
      if (leftHand && rightHand) {
        energySphereCenter = this.calculateEnergySphereCenter(
          leftHand,
          rightHand
        );
      }
    }

    return {
      state: this.gestureState,
      chargingDuration: this.chargingDuration,
      chargingProgress: Math.min(
        this.chargingDuration / this.maxChargingTime,
        1.0
      ),
      firingFrameCount: this.firingFrameCount,
      firingDirection: this.beamDirection,
      energySphereCenter: energySphereCenter,
      allowedFiringDuration: this.allowedFiringDuration,
      currentFiringDuration: this.gestureState === "firing" ? (currentTime - this.firingStartTime) : 0,
      firingProgress: this.allowedFiringDuration > 0 && this.gestureState === "firing" 
        ? Math.min((currentTime - this.firingStartTime) / this.allowedFiringDuration, 1.0) 
        : 0,
    };
  }

  // Helper method to get current gesture data
  getGestureData() {
    const currentTime = Date.now();
    
    // Calculate energy sphere center if hands are available for charging state
    let energySphereCenter = null;
    if (this.currentHands && this.currentHands.length === 2 && this.gestureState === "charging") {
      const [leftHand, rightHand] = this.identifyHands(this.currentHands);
      if (leftHand && rightHand) {
        energySphereCenter = this.calculateEnergySphereCenter(leftHand, rightHand);
      }
    }

    return {
      state: this.gestureState,
      chargingDuration: this.chargingDuration,
      chargingProgress: Math.min(
        this.chargingDuration / this.maxChargingTime,
        1.0
      ),
      firingFrameCount: this.firingFrameCount,
      firingDirection: this.beamDirection,
      energySphereCenter: energySphereCenter,
      allowedFiringDuration: this.allowedFiringDuration,
      currentFiringDuration: this.gestureState === "firing" ? (currentTime - this.firingStartTime) : 0,
      firingProgress: this.allowedFiringDuration > 0 && this.gestureState === "firing" 
        ? Math.min((currentTime - this.firingStartTime) / this.allowedFiringDuration, 1.0) 
        : 0,
    };
  }

  // Reset the detector
  reset() {
    this.gestureState = "idle";
    this.stateStartTime = 0;
    this.chargingDuration = 0;
    this.positioningFrameCount = 0;
    this.firingFrameCount = 0;
    this.firingStartTime = 0;
    this.allowedFiringDuration = 0;
    this.firingStabilityCounter = 0; // Reset stability counter
    this.gestureHistory = [];
    this.currentHands = null; // Reset current hands reference
  }
}
