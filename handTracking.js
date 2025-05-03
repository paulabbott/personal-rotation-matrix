// Hand Tracking Configuration
const MODEL_TYPE = 'lite';  // 'lite' for speed, 'full' for accuracy
const MAX_HANDS = 4;        // number of hands to detect
const OFF_W = 256;          // reduced processing width for better performance
const OFF_H = 192;          // reduced processing height for better performance
const DETECTION_INTERVAL = 5; // process every 3 frames

// Pinch detection configuration
const SMOOTHING_WINDOW_SIZE = 5; // Size of the smoothing window
const DEBOUNCE_TIME = 300; // Debounce time in milliseconds
const FLASH_DURATION = 200; // Flash duration in milliseconds
const Z_OFFSET_SCALE = 1.5; // Scale factor for z-offset based calculations

// pre-defined skeleton connections (21-point hand)
const skeleton = [
    [0, 1], [1, 2], [2, 3], [3, 4],     // thumb
    [0, 5], [5, 6], [6, 7], [7, 8],     // index finger
    [0, 9], [9, 10], [10, 11], [11, 12], // middle finger
    [0, 13], [13, 14], [14, 15], [15, 16], // ring finger
    [0, 17], [17, 18], [18, 19], [19, 20]  // pinky
];

async function setupBackend() {
    await tf.setBackend('webgl');
    await tf.ready();
}

async function setupCamera(videoElement) {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    });
    videoElement.srcObject = stream;
    await new Promise(r => videoElement.onloadedmetadata = r);
    videoElement.play();
    return videoElement;
}

async function createDetector() {
    return handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
            modelType: MODEL_TYPE,
            maxHands: MAX_HANDS
        }
    );
}

// Helper function to calculate smoothed value from buffer
function getSmoothedValue(buffer) {
    if (buffer.length === 0) return 0;
    return buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
}

// Helper function to update buffer with new value
function updateBuffer(buffer, value) {
    buffer.push(value);
    if (buffer.length > SMOOTHING_WINDOW_SIZE) {
        buffer.shift();
    }
}

//measure how big the hand is in the image and use this as an approximation
//for closeness to the camera, ie position along the z-axis.
function calculateZOffset(hand) {
    if (!hand || !hand.keypoints) return 0;

    // Use wrist (0), index finger base (5), and pinky base (17) to estimate hand size
    const wrist = hand.keypoints[0];
    const indexBase = hand.keypoints[5];
    const pinkyBase = hand.keypoints[17];

    // Calculate average distance from wrist to finger bases
    const dist1 = Math.sqrt(
        Math.pow(wrist.x - indexBase.x, 2) +
        Math.pow(wrist.y - indexBase.y, 2)
    );
    const dist2 = Math.sqrt(
        Math.pow(wrist.x - pinkyBase.x, 2) +
        Math.pow(wrist.y - pinkyBase.y, 2)
    );

    return (dist1 + dist2) / 2;
}

// Helper function to calculate pinch distance
function calculatePinchDistance(hand) {
    if (!hand || !hand.keypoints) return Infinity;

    // Use thumb tip (4) and index finger tip (8)
    const thumb = hand.keypoints[4];
    const index = hand.keypoints[8];

    return Math.sqrt(
        Math.pow(thumb.x - index.x, 2) +
        Math.pow(thumb.y - index.y, 2)
    );
} 