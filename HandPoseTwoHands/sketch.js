/*
Documentation:
https://docs.ml5js.org/#/reference/handpose?id=examples

This sketch is to show two hand tracking, drawing a line between  
pinched fingers on two hands

*/

let handPose;
let video;
let videoProcess; // Downsampled copy for processing
let hands = [];
let zOffsetBuffers = [[], []]; // Buffers for smoothing zOffset values
const SMOOTHING_WINDOW_SIZE = 5; // Size of the smoothing window
let gridRotation = Array(4).fill().map(() => Array(4).fill(0)); // Track rotation state (0, 90, 180, 270 degrees)
let flashTimers = Array(4).fill().map(() => Array(4).fill(0)); // Track flash timing for each square
const FLASH_DURATION = 200; // Flash duration in milliseconds
let squareX, squareY, gridSize; // Declare as global variables
let pinchActive = [false, false]; // Array to track pinch state for each hand
let pinchDistBuffers = [[], []]; // Buffers for smoothing pinchDist values
let lastPinchTime = [0, 0]; // Array to track the last pinch time for each hand
const DEBOUNCE_TIME = 300; // Debounce time in milliseconds
let sharedBuffer = null; // Single shared graphics buffer
let debugInfoVisible = true; // Track if debug information should be shown

// Grid configuration
const GRID_ROWS = 4; // Number of rows in the grid
const GRID_COLS = 4; // Number of columns in the grid
const TOP_MARGIN = 80; // Distance from top of canvas in pixels
const BOTTOM_MARGIN = 200; // Distance from bottom of canvas in pixels

// Processing configuration
const PROCESS_WIDTH = 320; // Fixed width for processing video
let processScale; // Will be calculated based on PROCESS_WIDTH
let videoScaleX, videoScaleY; // Added for video scale calculation
let handTrackingScale; // Added for hand tracking scale calculation

function preload() {
  //can set number of hands to detect
  let options = {
    maxHands: 2,
    flipped: true // make it like a mirror 
  }
  handPose = ml5.handPose(options);
}

function setup() {
  // First create a temporary video capture to get native resolution
  let tempVideo = createCapture(VIDEO, { flipped: true }, function() {
    console.log('Hardware webcam resolution:', tempVideo.width, 'x', tempVideo.height);
    tempVideo.remove(); // Remove the temporary video after getting resolution
  });

  // Calculate dimensions based on viewport height while maintaining 4:3 aspect ratio
  let canvasHeight = windowHeight;
  let canvasWidth = (canvasHeight * 4) / 3;
  
  // Create canvas with calculated dimensions
  createCanvas(canvasWidth, canvasHeight);
  select('canvas').position(0, 0);
  
  // Create video capture at fixed 640x480 resolution
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();

  // Calculate video scale factors
  videoScaleX = canvasWidth / 640;
  videoScaleY = canvasHeight / 480;

  // Calculate processing height maintaining aspect ratio
  let processHeight = (PROCESS_WIDTH * 3) / 4;
  
  // Calculate scale factor based on the new video width
  processScale = PROCESS_WIDTH / 640; // Now based on 640px video width

  // Calculate hand tracking scale factor (processing video to canvas)
  handTrackingScale = {
    x: canvasWidth / PROCESS_WIDTH,
    y: canvasHeight / processHeight
  };

  // Create downsampled copy for processing
  videoProcess = createCapture(VIDEO, { flipped: true });
  videoProcess.size(PROCESS_WIDTH, processHeight);
  videoProcess.hide();

  // Start hand tracking on the downsampled video
  handPose.detectStart(videoProcess, gotHands);

  // Initialize grid dimensions
  updateGridDimensions();

  // Add window resize handler
  window.addEventListener('resize', function() {
    // Recalculate canvas dimensions
    let newCanvasHeight = windowHeight;
    let newCanvasWidth = (newCanvasHeight * 4) / 3;
    resizeCanvas(newCanvasWidth, newCanvasHeight);
    
    // Update video scales
    videoScaleX = newCanvasWidth / 640;
    videoScaleY = newCanvasHeight / 480;
    handTrackingScale = {
      x: newCanvasWidth / PROCESS_WIDTH,
      y: newCanvasHeight / processHeight
    };
    
    // Update grid dimensions
    updateGridDimensions();
  });
}

function updateGridDimensions() {
  let squareSize = height - (TOP_MARGIN + BOTTOM_MARGIN);
  squareX = (width - squareSize) / 2;
  squareY = TOP_MARGIN;
  gridSize = squareSize / GRID_ROWS;
  
  // Properly dispose of old buffer if it exists
  if (sharedBuffer) {
    sharedBuffer.remove();
  }
  sharedBuffer = createGraphics(gridSize, gridSize);
}

function draw() {
  // Draw the full resolution video feed
  image(video, 0, 0, width, height);

  // Calculate grid dimensions
  let squareSize = height - (TOP_MARGIN + BOTTOM_MARGIN);
  squareX = (width - squareSize) / 2;
  squareY = TOP_MARGIN;
  gridSize = squareSize / GRID_ROWS;

  // Draw rotated portions for all squares using shared buffer
  for (let i = 0; i < GRID_ROWS; i++) {
    for (let j = 0; j < GRID_COLS; j++) {
      let x = squareX + j * gridSize;
      let y = squareY + i * gridSize;
      
      // Reuse the same buffer for all squares
      sharedBuffer.clear();
      sharedBuffer.image(video, 
        0, 0, 
        gridSize, gridSize, 
        x / videoScaleX, y / videoScaleY, 
        gridSize / videoScaleX, gridSize / videoScaleY
      );
      
      // Apply rotation if needed
      if (gridRotation[i][j] !== 0) {
        sharedBuffer.push();
        sharedBuffer.translate(gridSize/2, gridSize/2);
        sharedBuffer.rotate(radians(gridRotation[i][j]));
        sharedBuffer.translate(-gridSize/2, -gridSize/2);
        sharedBuffer.image(video, 
          0, 0, 
          gridSize, gridSize, 
          x / videoScaleX, y / videoScaleY, 
          gridSize / videoScaleX, gridSize / videoScaleY
        );
        sharedBuffer.pop();
      }
      
      // Draw the rotated square
      push();
      translate(x + gridSize/2, y + gridSize/2);
      rotate(radians(gridRotation[i][j]));
      image(sharedBuffer, -gridSize/2, -gridSize/2);
      pop();
    }
  }

  // Draw grid overlay with flashing effect
  for (let i = 0; i < GRID_ROWS; i++) {
    for (let j = 0; j < GRID_COLS; j++) {
      let alpha = 0;
      if (flashTimers[i][j] > 0) {
        // Calculate alpha based on time remaining
        alpha = map(flashTimers[i][j], FLASH_DURATION, 0, 200, 0);
        flashTimers[i][j] -= deltaTime;
      }
      fill(255, 255, 255, alpha);
      rect(squareX + j * gridSize, squareY + i * gridSize, gridSize, gridSize);
    }
  }

  // Subdivide the square into a grid with light grey lines
  stroke(200); // Light grey color
  strokeWeight(1);
  for (let i = 1; i < GRID_ROWS; i++) {
    // Vertical lines
    line(squareX + i * gridSize, squareY, squareX + i * gridSize, squareY + squareSize);
    // Horizontal lines
    line(squareX, squareY + i * gridSize, squareX + squareSize, squareY + i * gridSize);
  }

  drawHandsLine(processScale);
}

function gotHands(results) {
  hands = results;
}

function getGridCellIndex(x, y, squareX, squareY, gridSize) {
  let col = Math.floor((x - squareX) / gridSize);
  let row = Math.floor((y - squareY) / gridSize);
  return { row, col };
}

function drawHandsLine(scale) {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    let keypoints = hand.keypoints;
    let indexF = keypoints[8]; // Index finger tip
    let thumb = keypoints[4]; // Thumb tip

    // Scale up the coordinates from the processed video to match canvas size
    let scaledIndexF = {
      x: indexF.x * handTrackingScale.x,
      y: indexF.y * handTrackingScale.y
    };
    let scaledThumb = {
      x: thumb.x * handTrackingScale.x,
      y: thumb.y * handTrackingScale.y
    };

    // Draw palm triangle using wrist (0), index finger base (5), and pinky base (17)
    let wrist = {
      x: keypoints[0].x * handTrackingScale.x,
      y: keypoints[0].y * handTrackingScale.y
    };
    let indexBase = {
      x: keypoints[5].x * handTrackingScale.x,
      y: keypoints[5].y * handTrackingScale.y
    };
    let pinkyBase = {
      x: keypoints[17].x * handTrackingScale.x,
      y: keypoints[17].y * handTrackingScale.y
    };

    // Calculate hand size once and reuse
    let middleFinger = {
      x: keypoints[9].x * handTrackingScale.x,
      y: keypoints[9].y * handTrackingScale.y
    };
    let handSize = dist(wrist.x, wrist.y, middleFinger.x, middleFinger.y);
    
    // Calculate normalized triangle dimensions
    let palmWidth = dist(indexBase.x, indexBase.y, pinkyBase.x, pinkyBase.y) / handSize;
    let palmHeight = dist(wrist.x, wrist.y, (indexBase.x + pinkyBase.x) / 2, (indexBase.y + pinkyBase.y) / 2) / handSize;
    let palmArea = (palmWidth * palmHeight) / 2;

    // Draw the triangle only if debug info is visible
    if (debugInfoVisible) {
      stroke(255, 0, 0); // Red color for the triangle
      strokeWeight(2);
      noFill();
      triangle(
        wrist.x, wrist.y,
        indexBase.x, indexBase.y,
        pinkyBase.x, pinkyBase.y
      );
    }

    // Draw a line between the thumb and index finger
    stroke(0, 0, 0);
    strokeWeight(2);
    line(scaledThumb.x, scaledThumb.y, scaledIndexF.x, scaledIndexF.y);

    // Calculate the midpoint
    let midX = (scaledThumb.x + scaledIndexF.x) / 2;
    let midY = (scaledThumb.y + scaledIndexF.y) / 2;

    // zOffset is acting as our threshold value to determine if a pinch has happened
    let zOffset = map(handSize, 50, 200, 20, 80); // Dynamically adjust based on hand size

    // Add zOffset to the buffer and maintain the buffer size
    zOffsetBuffers[i].push(zOffset);
    if (zOffsetBuffers[i].length > SMOOTHING_WINDOW_SIZE) {
      zOffsetBuffers[i].shift();
    }

    // Calculate the smoothed zOffset
    let smoothedZOffset = zOffsetBuffers[i].reduce((sum, val) => sum + val, 0) / zOffsetBuffers[i].length;

    //measure distance between thumb and index finger
    let pinchDist = dist(scaledThumb.x, scaledThumb.y, scaledIndexF.x, scaledIndexF.y);

    // Add pinchDist to the buffer and maintain the buffer size
    pinchDistBuffers[i].push(pinchDist);
    if (pinchDistBuffers[i].length > SMOOTHING_WINDOW_SIZE) {
      pinchDistBuffers[i].shift();
    }

    // Calculate the smoothed pinchDist
    let smoothedPinchDist = pinchDistBuffers[i].reduce((sum, val) => sum + val, 0) / pinchDistBuffers[i].length;

    // Display smoothed zOffset, pinchDist, and palm area values only if debug info is visible
    if (debugInfoVisible) {
      noStroke();    
      fill(255);
      textSize(16);
      if (i === 0) { // Left hand
        text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)} | palmArea: ${palmArea.toFixed(4)}`, 10, 20);
        text(`Display: ${video.width}x${video.height} | Process: ${videoProcess.width}x${videoProcess.height}`, 10, 40);
      } else if (i === 1) { // Right hand
        text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)} | palmArea: ${palmArea.toFixed(4)}`, width - 300, 20);
      }
    }

    // zOffset is acting as our threshold value to determine if a pinch has happened
    let pinchThreshold = smoothedZOffset / 2;
    stroke(0, 0, 0);
    noFill();
    ellipse(midX, midY, pinchThreshold, pinchThreshold);
    noStroke();

    if (smoothedPinchDist < pinchThreshold) {
      let currentTime = millis();
      if (!pinchActive[i] && (currentTime - lastPinchTime[i] > DEBOUNCE_TIME)) {
        // Determine which grid cell the midpoint is in
        let { row, col } = getGridCellIndex(midX, midY, squareX, squareY, gridSize);
        if (row >= 0 && row < 4 && col >= 0 && col < 4) {
          // Increment rotation by 90 degrees when pinched
          gridRotation[row][col] = (gridRotation[row][col] + 90) % 360;
          // Start the flash timer
          flashTimers[row][col] = FLASH_DURATION;
        }

        // Set pinch as active
        pinchActive[i] = true;
        lastPinchTime[i] = currentTime;
      }
    } else {
      // Reset pinch state when pinch is released
      pinchActive[i] = false;
    }
  }
}

// Add keyPressed function to toggle debug info
function keyPressed() {
  if (key === 'd' || key === 'D') {
    debugInfoVisible = !debugInfoVisible;
  }
}

// Note: For better performance with many rotations, consider implementing a WebGL shader version:
// 1. Create a shader program that handles the rotation
// 2. Pass the video texture and rotation angles to the shader
// 3. Use instanced rendering for the grid squares
// This would significantly reduce CPU usage and improve performance for complex scenes.

// Add cleanup function
function windowCleared() {
  // Stop hand tracking
  if (handPose) {
    handPose.detectStop();
  }
  
  // Remove video captures
  if (video) {
    video.remove();
  }
  if (videoProcess) {
    videoProcess.remove();
  }
  
  // Clear buffers
  zOffsetBuffers = [[], []];
  pinchDistBuffers = [[], []];
  
  // Remove shared buffer
  if (sharedBuffer) {
    sharedBuffer.remove();
  }
}

// Add event listener for page unload
window.addEventListener('beforeunload', windowCleared);

