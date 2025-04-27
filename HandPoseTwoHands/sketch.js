/*
Documentation:
https://docs.ml5js.org/#/reference/handpose?id=examples

This sketch is to show two hand tracking, drawing a line between  
pinched fingers on two hands

*/

let handPose;
let video;
let hands = [];
let handsLine = [];
let loaded = false;
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

// Grid configuration
const GRID_ROWS = 4; // Number of rows in the grid
const GRID_COLS = 4; // Number of columns in the grid
const TOP_MARGIN = 40; // Distance from top of canvas in pixels
const BOTTOM_MARGIN = 200; // leave large space at bottom to help whole hand detection

// Video processing configuration
const VIDEO_SCALE = 0.1; // Scale down video processing (0.5 = half size)

function preload() {
  //can set number of hands to detect
  let options = {
    maxHands: 4,
    flipped: true // make it like a mirror 
  }
  handPose = ml5.handPose(options);
}

function setup() {
  // Calculate dimensions based on viewport height while maintaining 4:3 aspect ratio
  let canvasHeight = windowHeight;
  let canvasWidth = (canvasHeight * 4) / 3;
  
  // Create canvas with calculated dimensions
  createCanvas(canvasWidth, canvasHeight);
  select('canvas').position(0, 0);
  
  // Set video dimensions smaller than canvas for processing
  video = createCapture(VIDEO, { flipped: true });
  video.size(canvasWidth * VIDEO_SCALE, canvasHeight * VIDEO_SCALE);
  video.hide();
  handPose.detectStart(video, gotHands);

  // Initialize single shared buffer
  let squareSize = canvasHeight - (TOP_MARGIN + BOTTOM_MARGIN);
  gridSize = squareSize / GRID_ROWS;
  sharedBuffer = createGraphics(gridSize, gridSize);
}

function draw() {
  // Draw the full video feed first, scaled up to canvas size
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
      // Scale the video portion to fit the grid cell
      sharedBuffer.image(video, 0, 0, gridSize, gridSize, 
        x * VIDEO_SCALE, y * VIDEO_SCALE, 
        gridSize * VIDEO_SCALE, gridSize * VIDEO_SCALE);
      
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

  drawHandsLine();
}

function gotHands(results) {
  hands = results;
}

function getGridCellIndex(x, y, squareX, squareY, gridSize) {
  let col = Math.floor((x - squareX) / gridSize);
  let row = Math.floor((y - squareY) / gridSize);
  return { row, col };
}

function drawHandsLine() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    let keypoints = hand.keypoints;
    let indexF = keypoints[8]; // Index finger tip
    let thumb = keypoints[4]; // Thumb tip

    // Scale the keypoint positions to match the video scale
    let scaledIndexF = {
      x: indexF.x / VIDEO_SCALE,
      y: indexF.y / VIDEO_SCALE
    };
    let scaledThumb = {
      x: thumb.x / VIDEO_SCALE,
      y: thumb.y / VIDEO_SCALE
    };

    // Draw palm triangle using wrist (0), index finger base (5), and pinky base (17)
    let wrist = {
      x: keypoints[0].x / VIDEO_SCALE,
      y: keypoints[0].y / VIDEO_SCALE
    };
    let indexBase = {
      x: keypoints[5].x / VIDEO_SCALE,
      y: keypoints[5].y / VIDEO_SCALE
    };
    let pinkyBase = {
      x: keypoints[17].x / VIDEO_SCALE,
      y: keypoints[17].y / VIDEO_SCALE
    };

    // Draw the triangle
    stroke(255, 0, 0); // Red color for the triangle
    strokeWeight(2);
    noFill();
    triangle(
      wrist.x, wrist.y,
      indexBase.x, indexBase.y,
      pinkyBase.x, pinkyBase.y
    );

    // Draw a line between the thumb and index finger
    stroke(0, 0, 0);
    strokeWeight(2);
    line(scaledThumb.x, scaledThumb.y, scaledIndexF.x, scaledIndexF.y);

    // Calculate the midpoint
    let midX = (scaledThumb.x + scaledIndexF.x) / 2;
    let midY = (scaledThumb.y + scaledIndexF.y) / 2;

    //get the distance between the top and bottom of the palm to give us an estimate of how far the hand is from the camera
    let avgHandSize = dist(wrist.x, wrist.y, keypoints[9].x / VIDEO_SCALE, keypoints[9].y / VIDEO_SCALE);
    let zOffset = map(avgHandSize, 50, 200, 20, 80); // Dynamically adjust based on hand size

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

    // Display smoothed zOffset, pinchDist, and palm area values
    noStroke();    
    fill(255);
    textSize(16);
    if (i === 0) { // Left hand
      text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)}`, 10, 20);
    } else if (i === 1) { // Right hand
      text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)}`, width - 300, 20);
    }

    // zOffset is acting as our threshold value to determine if a pinch has happened
    let pinchThreshold = smoothedZOffset / 1.25;
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

function drawKeypoints() {
  // loop through key points on each hand and draw a circle at each point
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(128, 128, 128);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }
}

// Note: For better performance with many rotations, consider implementing a WebGL shader version:
// 1. Create a shader program that handles the rotation
// 2. Pass the video texture and rotation angles to the shader
// 3. Use instanced rendering for the grid squares
// This would significantly reduce CPU usage and improve performance for complex scenes.

